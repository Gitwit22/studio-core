import { Router } from "express";
import type Stripe from "stripe";
import type { DocumentReference } from "firebase-admin/firestore";
import { stripe } from "../lib/stripe";
import { firestore as db } from "../firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { PLAN_IDS, PlanId, isPlanId } from "../types/plan";
import { getUserAccount } from "../lib/userAccount";
import { CURRENT_TOS_VERSION, hasAcceptedCurrentTos } from "../lib/tos";
import { PERMISSION_ERRORS } from "../lib/permissionErrors";
import { comparePlans } from "../lib/planRank";
import {
  applyDailyWindowReset,
  applySuccessfulPlanChange,
  assertDailyPlanLimit,
  assertMonthlyDowngradeLimit,
  normalizeBillingGuards,
  type BillingGuards,
} from "../lib/billingGuards";
import { createOveragesEndpointHandler } from "../lib/overagesEndpoint";

const PLAN_CHANGE_LOCK_TTL_MS = 60 * 1000; // 60 seconds

type PlanChangeHistoryEntry = {
  at: number; // epoch ms
  fromPlan: string;
  toPlan: string;
  source: string;
};

// Simple in-memory throttle for test-mode plan switching
const TEST_PLAN_CHANGE_THROTTLE_MS = 2000; // 1 req / 2s per uid
const testPlanChangeThrottle = new Map<string, number>();

function getUserRef(uid: string) {
  return db.collection("users").doc(uid);
}

function sanitizeHistory(history: any): PlanChangeHistoryEntry[] {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => ({
      at: Number(entry?.at || 0),
      fromPlan: String(entry?.fromPlan || "unknown"),
      toPlan: String(entry?.toPlan || "unknown"),
      source: String(entry?.source || "unknown"),
    }))
    .filter((entry) => Number.isFinite(entry.at) && entry.at > 0)
    .sort((a, b) => a.at - b.at)
    .slice(-10);
}

async function acquirePlanChangeLock(params: {
  userRef: DocumentReference;
  requestId: string;
  targetPlanId: PlanId;
}) {
  const { userRef, requestId, targetPlanId } = params;
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) {
      throw Object.assign(new Error("user_not_found"), { code: "USER_NOT_FOUND" });
    }

    const user = snap.data() as any;

    const currentPlanId: PlanId = isPlanId(user?.planId) ? (user.planId as PlanId) : "free";
    const direction = comparePlans(currentPlanId, targetPlanId);

    // Canonical plan-change guards (stored on user doc).
    let guards: BillingGuards = normalizeBillingGuards(user?.billingGuards, now);

    // Daily limit (rolling 24h, max 3 changes) applies to upgrades and downgrades.
    const daily = assertDailyPlanLimit(guards, now);
    if (!daily.ok) {
      throw Object.assign(new Error("plan_change_limit_daily"), {
        code: "DAILY_LIMIT",
        retryAfterMs: daily.retryAfterMs,
      });
    }

    // If the window expired, reset it now (does not count as a change).
    if ((daily as any).reset) {
      guards = applyDailyWindowReset(guards, now);
      tx.set(
        userRef,
        {
          billingGuards: guards,
        },
        { merge: true }
      );
    }

    // Downgrade-only rule: once per rolling 30 days.
    if (direction < 0) {
      const down = assertMonthlyDowngradeLimit(guards, now);
      if (!down.ok) {
        throw Object.assign(new Error("downgrade_limit_monthly"), {
          code: "MONTHLY_DOWNGRADE_LIMIT",
          retryAfterMs: down.retryAfterMs,
        });
      }
    }

    const lock = user?.planChangeLock;
    const lockActive =
      lock && typeof lock.expiresAt === "number" && lock.expiresAt > now;

    // Another request holds the lock
    if (lockActive && lock.token !== requestId) {
      throw Object.assign(new Error("plan_change_locked"), {
        code: "LOCKED",
        lockUntil: lock.expiresAt,
      });
    }

    const newLock = {
      token: requestId,
      acquiredAt: now,
      expiresAt: now + PLAN_CHANGE_LOCK_TTL_MS,
    };

    tx.set(
      userRef,
      {
        planChangeLock: newLock,
        planChangeRequestId: requestId,
      },
      { merge: true }
    );

    return { user, newLock, currentPlanId, direction };
  });
}

const router = Router();


// Canonical Stripe price lookup for any plan
function priceIdFor(plan: PlanId, planMeta?: any) {
  if (plan === "starter") {
    const id = process.env.STRIPE_PRICE_STARTER;
    if (!id) throw new Error("Missing STRIPE_PRICE_STARTER");
    return id;
  }
  if (plan === "pro") {
    const id = process.env.STRIPE_PRICE_PRO;
    if (!id) throw new Error("Missing STRIPE_PRICE_PRO");
    return id;
  }
  if (plan === "basic") {
    const id = process.env.STRIPE_PRICE_BASIC;
    if (!id) throw new Error("Missing STRIPE_PRICE_BASIC");
    return id;
  }
  // For new plans, expect a stripePriceId in Firestore plan doc
  if (planMeta && typeof planMeta.stripePriceId === "string" && planMeta.stripePriceId.trim().length > 0) {
    return planMeta.stripePriceId;
  }
  throw new Error(`No Stripe price configured for plan: ${plan}`);
}

// Accept any PlanId + variant for checkout
type CheckoutPlanVariant = `${PlanId}_paid` | `${PlanId}_trial` | PlanId;

function planIdFromStripeSubscription(sub: any): PlanId {
  const metaPlan = String(sub?.metadata?.plan || "").trim();
  if (isPlanId(metaPlan as any)) return metaPlan as PlanId;

  const planVariant = String(sub?.metadata?.planVariant || "").trim();
  if (planVariant === "pro") return "pro";
  if (planVariant === "basic") return "basic";
  if (planVariant.startsWith("starter")) return "starter";

  const priceId = sub?.items?.data?.[0]?.price?.id;
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_BASIC) return "basic";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return "free";
}

router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: PERMISSION_ERRORS.UNAUTHORIZED });

    const { plan, requestId, tosAccepted } = (req.body || {}) as {
      plan?: CheckoutPlanVariant;
      requestId?: string;
      tosAccepted?: boolean;
    };
    if (!plan || typeof plan !== "string") {
      return res.status(400).json({ success: false, error: "Missing plan" });
    }

    if (!requestId || typeof requestId !== "string" || requestId.trim().length < 8) {
      return res.status(400).json({ success: false, error: "Missing requestId" });
    }

    // Parse canonical plan id from variant
    let canonicalPlan: PlanId | undefined;
    let variant: string = "";
    if (plan.endsWith("_trial")) {
      canonicalPlan = plan.slice(0, -6) as PlanId;
      variant = "trial";
    } else if (plan.endsWith("_paid")) {
      canonicalPlan = plan.slice(0, -5) as PlanId;
      variant = "paid";
    } else {
      canonicalPlan = plan as PlanId;
      variant = "paid";
    }
    if (!isPlanId(canonicalPlan)) {
      return res.status(400).json({ success: false, error: "Invalid plan" });
    }

    const CLIENT_URL = process.env.CLIENT_URL;
    if (!CLIENT_URL) throw new Error("Missing env var: CLIENT_URL");

    // Normalize account and bypass Stripe when billing is effectively disabled
    const account = (req as any).account || await getUserAccount(uid);

    if (account.effectiveBillingEnabled === false) {
      // Billing is OFF (dev/admin override). Allow preflight without Stripe checks.
      return res.json({
        success: true,
        billing: { mode: "disabled" },
      });
    }


    const userRef = getUserRef(uid);
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "User not found" });

    const user = snap.data() as any;

    // Idempotent: return the prior result if this requestId already finished
    if (user?.planChangeRequestId === requestId && user?.planChangeRequestResult) {
      return res.json({ success: true, reused: true, ...user.planChangeRequestResult });
    }

    // Acquire lock + guard enforcement
    let lockedUser: any = null;
    try {
      lockedUser = await acquirePlanChangeLock({ userRef, requestId, targetPlanId: canonicalPlan });
    } catch (err: any) {
      if (err?.code === "DAILY_LIMIT") {
        return res.status(429).json({ success: false, error: "plan_change_limit_daily", retryAfterMs: err.retryAfterMs });
      }
      if (err?.code === "MONTHLY_DOWNGRADE_LIMIT") {
        return res.status(429).json({ success: false, error: "downgrade_limit_monthly", retryAfterMs: err.retryAfterMs });
      }
      if (err?.code === "LOCKED") {
        return res.status(409).json({ success: false, error: "plan_change_locked", lockUntil: err.lockUntil });
      }
      if (err?.code === "USER_NOT_FOUND") {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      throw err;
    }

    const userAtLock = lockedUser?.user ?? user;
    const currentPlanId: PlanId = isPlanId(userAtLock?.planId) ? (userAtLock.planId as PlanId) : "free";
    const direction = comparePlans(currentPlanId, canonicalPlan);

    // Enforce Terms of Service acceptance before creating a checkout session.
    if (!hasAcceptedCurrentTos(userAtLock)) {
      if (tosAccepted === true) {
        const now = Date.now();
        await userRef.set(
          {
            tosVersion: CURRENT_TOS_VERSION,
            tosAcceptedAt: now,
            tosAcceptedIp: req.ip || undefined,
            tosUserAgent: req.get("user-agent") || undefined,
          },
          { merge: true }
        );
        (userAtLock as any).tosVersion = CURRENT_TOS_VERSION;
        (userAtLock as any).tosAcceptedAt = now;
      } else {
        await userRef.set({ planChangeLock: null }, { merge: true });
        return res.status(403).json({
          success: false,
          error: "tos_not_accepted",
          tosVersion: (userAtLock as any)?.tosVersion || null,
          currentTosVersion: CURRENT_TOS_VERSION,
        });
      }
    }

    // Trial eligibility
    const hasHadTrial = userAtLock?.billing?.hasHadTrial === true;
    const DEFAULT_TRIAL_DAYS = Number(process.env.STRIPE_STARTER_TRIAL_DAYS || "5");

    // Trial logic: only when explicitly chosen AND not already used
    const useTrial = variant === "trial" && !hasHadTrial;
    const trialDays = useTrial ? DEFAULT_TRIAL_DAYS : 0;

    const subscriptionId: string | undefined = userAtLock?.billing?.subscriptionId || userAtLock?.stripeSubscriptionId;

    // Fast-path: existing active subscription => apply upgrade immediately or schedule downgrade.
    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const billingStatus = String((sub as any)?.status || "none");
      const billingActive = billingStatus === "active" || billingStatus === "trialing";

      if (billingActive && direction !== 0) {
        const itemId: string | undefined = (sub as any)?.items?.data?.[0]?.id;
        const currentPriceId: string | undefined = (sub as any)?.items?.data?.[0]?.price?.id;
        if (!itemId || !currentPriceId) {
          await userRef.set({ planChangeLock: null }, { merge: true });
          return res.status(500).json({ success: false, error: "subscription_item_missing" });
        }

        // Fetch plan metadata from Firestore for custom plans
        let planMeta: any = {};
        try {
          const planSnap = await db.collection("plans").doc(canonicalPlan).get();
          if (planSnap.exists) planMeta = planSnap.data();
        } catch {}

        const targetPriceId = priceIdFor(canonicalPlan, planMeta);
        const now = Date.now();
        const guards = normalizeBillingGuards(userAtLock?.billingGuards, now);
        const nextGuards = applySuccessfulPlanChange({ guards, nowMs: now, isDowngrade: direction < 0 });

        if (direction > 0) {
          // Upgrade: effective immediately.
          const updated = await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: false,
            items: [{ id: itemId, price: targetPriceId }],
            proration_behavior: "always_invoice",
            metadata: {
              ...(sub as any)?.metadata,
              userId: uid,
              plan: canonicalPlan,
              planVariant: canonicalPlan,
            },
          } as any);

          const currentPeriodEndSec = (updated as any).current_period_end as number | undefined;
          const currentPeriodEnd = typeof currentPeriodEndSec === "number" ? currentPeriodEndSec * 1000 : null;

          const history = sanitizeHistory(userAtLock?.planChangeHistory);
          const nextHistory =
            currentPlanId === canonicalPlan
              ? history
              : [...history, { at: now, fromPlan: currentPlanId, toPlan: canonicalPlan, source: "upgrade" }].slice(-10);

          await userRef.set(
            {
              planId: canonicalPlan,
              pendingPlan: null,
              scheduledPlanChange: null,
              billingGuards: nextGuards,
              planChangeHistory: nextHistory,
              planChangeLock: null,
              planChangeRequestId: requestId,
              planChangeRequestResult: {
                requestId,
                status: "ok",
                mode: "upgrade",
                plan: canonicalPlan,
                createdAt: now,
              },
              billingActive: billingStatus === "active" || billingStatus === "trialing",
              billingStatus,
              billing: {
                ...(userAtLock?.billing || {}),
                provider: "stripe",
                customerId: (sub as any)?.customer ?? userAtLock?.stripeCustomerId ?? userAtLock?.billing?.customerId ?? null,
                subscriptionId: subscriptionId,
                priceId: targetPriceId,
                cancelAtPeriodEnd: !!(updated as any).cancel_at_period_end,
                currentPeriodEnd,
                updatedAt: now,
              },
              updatedAt: now,
            },
            { merge: true }
          );

          return res.json({ success: true, mode: "upgrade", planId: canonicalPlan, requestId });
        }

        // Downgrade: schedule at period end.
        const currentPeriodEndSec = (sub as any).current_period_end as number | undefined;
        const currentPeriodEnd = typeof currentPeriodEndSec === "number" ? currentPeriodEndSec : null;
        const currentPeriodStartSec = (sub as any).current_period_start as number | undefined;
        const currentPeriodStart = typeof currentPeriodStartSec === "number" ? currentPeriodStartSec : Math.floor(now / 1000);
        if (!currentPeriodEnd) {
          await userRef.set({ planChangeLock: null }, { merge: true });
          return res.status(500).json({ success: false, error: "subscription_period_missing" });
        }

        const scheduleIdExisting = (sub as any).schedule || (sub as any).subscription_schedule;
        const schedule = scheduleIdExisting
          ? await stripe.subscriptionSchedules.retrieve(String(scheduleIdExisting))
          : await stripe.subscriptionSchedules.create({ from_subscription: subscriptionId } as any);

        const scheduleId = schedule.id;

        await stripe.subscriptionSchedules.update(
          scheduleId,
          {
            end_behavior: "release",
            phases: [
              {
                start_date: currentPeriodStart,
                end_date: currentPeriodEnd,
                items: [{ price: currentPriceId, quantity: 1 }],
                proration_behavior: "none",
              },
              {
                start_date: currentPeriodEnd,
                items: [{ price: targetPriceId, quantity: 1 }],
                proration_behavior: "none",
              },
            ],
          } as any
        );

        const effectiveAtMs = currentPeriodEnd * 1000;

        const history = sanitizeHistory(userAtLock?.planChangeHistory);
        const nextHistory = [...history, { at: now, fromPlan: currentPlanId, toPlan: canonicalPlan, source: "downgrade_scheduled" }].slice(-10);

        await userRef.set(
          {
            // Keep current plan active until effective date.
            planId: currentPlanId,
            pendingPlan: canonicalPlan,
            scheduledPlanChange: {
              type: "downgrade",
              targetPlanId: canonicalPlan,
              effectiveAtMs,
              scheduleId,
            },
            billingGuards: nextGuards,
            planChangeHistory: nextHistory,
            planChangeLock: null,
            planChangeRequestId: requestId,
            planChangeRequestResult: {
              requestId,
              status: "ok",
              mode: "downgrade_scheduled",
              plan: canonicalPlan,
              effectiveAtMs,
              createdAt: now,
            },
            updatedAt: now,
          },
          { merge: true }
        );

        return res.json({ success: true, mode: "downgrade_scheduled", planId: currentPlanId, pendingPlan: canonicalPlan, effectiveAtMs, requestId });
      }
    }

    // Ensure Stripe customer exists (needed for first-time checkout)
    let customerId: string | undefined = userAtLock?.stripeCustomerId || userAtLock?.billing?.customerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userAtLock?.email,
        name: userAtLock?.displayName,
        metadata: { userId: uid },
      });

      customerId = customer.id;

      await userRef.set(
        {
          stripeCustomerId: customerId,
          billing: {
            provider: "stripe",
            customerId,
            updatedAt: Date.now(),
          },
        },
        { merge: true }
      );
    }

    // Fetch plan metadata from Firestore for custom plans
    let planMeta: any = {};
    try {
      const planSnap = await db.collection("plans").doc(canonicalPlan).get();
      if (planSnap.exists) planMeta = planSnap.data();
    } catch {}

    // Create Checkout Session
    const subscription_data: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        userId: uid,
        plan: canonicalPlan,
        planVariant: plan,
      },
      ...(useTrial ? { trial_period_days: trialDays } : {}),
      ...(useTrial
        ? { trial_settings: { end_behavior: { missing_payment_method: "cancel" } } }
        : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdFor(canonicalPlan, planMeta), quantity: 1 }],

      success_url: `${CLIENT_URL}/billing/success`,
      cancel_url: `${CLIENT_URL}/billing/canceled`,

      metadata: {
        userId: uid,
        plan: canonicalPlan,
        planVariant: plan,
      },

      subscription_data,
    });

    const now = Date.now();
    const guards = normalizeBillingGuards(userAtLock?.billingGuards, now);
    const nextGuards = applySuccessfulPlanChange({ guards, nowMs: now, isDowngrade: false });
    const history = sanitizeHistory(userAtLock?.planChangeHistory);
    const nextHistory = [
      ...history,
      {
        at: now,
        fromPlan: userAtLock?.planId || "free",
        toPlan: canonicalPlan,
        source: "checkout",
      },
    ].slice(-10);

    await userRef.set(
      {
        pendingPlan: canonicalPlan,
        scheduledPlanChange: null,
        billingGuards: nextGuards,
        planChangeHistory: nextHistory,
        planChangeLock: null,
        planChangeRequestId: requestId,
        planChangeRequestResult: {
          requestId,
          status: "ok",
          url: session.url,
          plan: canonicalPlan,
          createdAt: now,
        },
      },
      { merge: true }
    );

    return res.json({ success: true, url: session.url, requestId });
  } catch (err: any) {
    console.error("POST /api/billing/checkout failed:", err?.message || err);
    if (req?.body?.requestId) {
      try {
        await getUserRef((req as any).user?.uid).set(
          {
            planChangeLock: null,
          },
          { merge: true }
        );
      } catch {}
    }
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

router.post("/portal", requireAuth, async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: PERMISSION_ERRORS.UNAUTHORIZED });
    const account = (req as any).account || await getUserAccount(uid);
    if (account.effectiveBillingEnabled === false) {
      // Billing is disabled (Test Mode). Do not talk to Stripe; instead signal
      // to the client that the portal is unavailable due to billing being off,
      // but use a 200 status so this is not treated as a hard auth error.
      return res.json({ success: false, error: "billing_disabled" });
    }

    const snap = await getUserRef(uid).get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "User not found" });

    const user = snap.data() as any;

    const customerId = user?.stripeCustomerId || user?.billing?.customerId;
    if (!customerId) return res.status(400).json({ success: false, error: "No Stripe customer" });

    const CLIENT_URL = process.env.CLIENT_URL;
    if (!CLIENT_URL) throw new Error("Missing env var: CLIENT_URL");

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${CLIENT_URL}/settings/billing`,
    });

    return res.json({ success: true, url: portal.url });
  } catch (err: any) {
    console.error("POST /api/billing/portal failed:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// Test-mode only: allow self-service plan switching without Stripe when billing is disabled.
router.post("/test/change-plan", requireAuth, async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: PERMISSION_ERRORS.UNAUTHORIZED });

    const { newPlanId } = (req.body || {}) as { newPlanId?: string };
    if (!newPlanId || typeof newPlanId !== "string") {
      return res.status(400).json({ success: false, error: "missing_plan" });
    }

    const account = (req as any).account || await getUserAccount(uid);

    // Only allowed when billing is effectively disabled (platform-wide or per-user)
    if (account.effectiveBillingEnabled !== false) {
      return res
        .status(403)
        .json({ success: false, error: "billing_live" });
    }

    const isProd = process.env.NODE_ENV === "production";
    const platformDisabled = account.platformBillingEnabled === false;
    const userDisabled = account.billingEnabled === false;

    // Safety rails (especially for production):
    // - If billing is disabled platform-wide, treat it as an intentional test/staging mode and allow self-service.
    // - If only the user is in test mode while platform billing is enabled, require explicit tester flag in prod.
    // - Admins are always allowed.
    const raw = account.rawUser || {};
    const isTester = !!(raw.tester || raw.isTester);
    if (isProd && !account.isAdmin && !platformDisabled && userDisabled && !isTester) {
      return res.status(403).json({ success: false, error: "test_mode_disabled" });
    }

    const planIdCandidate = newPlanId as PlanId;
    if (!isPlanId(planIdCandidate)) {
      return res.status(400).json({ success: false, error: "invalid_plan" });
    }

    const now = Date.now();
    const last = testPlanChangeThrottle.get(uid) || 0;
    if (now - last < TEST_PLAN_CHANGE_THROTTLE_MS) {
      return res.status(429).json({ success: false, error: "too_many_requests" });
    }
    testPlanChangeThrottle.set(uid, now);

    const fromPlan = account.planId || "free";
    const userRef = getUserRef(uid);

    // In test mode, do not touch any Stripe or subscription fields; just update planId/pendingPlan.
    await userRef.set(
      {
        planId: planIdCandidate,
        pendingPlan: null,
        updatedAt: now,
      },
      { merge: true }
    );

    const ip = (req.headers["x-forwarded-for"] as string) || req.ip;
    const userAgent = (req.headers["user-agent"] as string) || "";
    const env = process.env.NODE_ENV || "development";
    const requestIdHeader = (req.headers["x-request-id"] as string) || "";
    const requestId = requestIdHeader || `${uid}-${now}`;

    await db.collection("billingAudit").add({
      type: "test_plan_change",
      uid,
      fromPlan,
      toPlan: planIdCandidate,
      at: now,
      ip,
      userAgent,
      env,
      requestId,
      source: "billing_test_mode",
    });

    return res.json({ success: true, planId: planIdCandidate });
  } catch (err: any) {
    console.error("POST /api/billing/test/change-plan failed:", err?.message || err);
    return res.status(500).json({ success: false, error: "Failed to change plan in test mode" });
  }
});

// Allow clients to clear a stale pendingPlan (e.g., user canceled checkout)
router.post("/clear-pending", requireAuth, async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: PERMISSION_ERRORS.UNAUTHORIZED });
    await getUserRef(uid).set({ pendingPlan: null }, { merge: true });
    return res.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/billing/clear-pending failed:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// Self-healing reconcile: if webhooks lag/miss, fetch Stripe subscription state and
// update planId + clear pendingPlan when the subscription is active/trialing.
router.post("/refresh", requireAuth, async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: PERMISSION_ERRORS.UNAUTHORIZED });

    const account = (req as any).account || await getUserAccount(uid);
    if (account.effectiveBillingEnabled === false) {
      return res.json({ success: false, error: "billing_disabled" });
    }

    const userRef = getUserRef(uid);
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "User not found" });
    const user = snap.data() as any;

    const subscriptionId: string | undefined = user?.billing?.subscriptionId || user?.stripeSubscriptionId;
    const customerId: string | undefined = user?.stripeCustomerId || user?.billing?.customerId;
    if (!subscriptionId && !customerId) {
      return res.status(400).json({ success: false, error: "no_stripe_customer" });
    }

    let sub: any = null;
    if (subscriptionId) {
      sub = await stripe.subscriptions.retrieve(subscriptionId);
    } else if (customerId) {
      const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
      const data = Array.isArray((list as any)?.data) ? (list as any).data : [];
      sub =
        data.find((s: any) => s?.status === "active" || s?.status === "trialing") ||
        data[0] ||
        null;
    }

    if (!sub) {
      return res.status(404).json({ success: false, error: "no_subscription" });
    }

    const nextPlan = planIdFromStripeSubscription(sub);
    const billingStatus = String(sub.status || "none");
    const billingActive = billingStatus === "active" || billingStatus === "trialing";
    const currentPeriodEndSec = (sub as any).current_period_end as number | undefined;
    const currentPeriodEnd = typeof currentPeriodEndSec === "number" ? currentPeriodEndSec * 1000 : null;
    const priceId = sub?.items?.data?.[0]?.price?.id ?? null;

    const stripeIndicatesScheduledChange =
      !!(sub as any).cancel_at_period_end ||
      !!(sub as any).pending_update ||
      !!(sub as any).schedule ||
      !!(sub as any).subscription_schedule;

    const prevPlan = (user?.planId as PlanId) || "free";
    const now = Date.now();
    const history = sanitizeHistory(user?.planChangeHistory);
    const nextHistory =
      prevPlan === nextPlan
        ? history
        : [...history, { at: now, fromPlan: prevPlan, toPlan: nextPlan, source: "billing_refresh" }].slice(-10);

    const scheduledPlanChange = user?.scheduledPlanChange || null;
    const preservePendingPlan =
      scheduledPlanChange &&
      scheduledPlanChange.type === "downgrade" &&
      typeof scheduledPlanChange.effectiveAtMs === "number" &&
      scheduledPlanChange.effectiveAtMs > now &&
      stripeIndicatesScheduledChange;

    const shouldClearScheduledPlanChange =
      scheduledPlanChange &&
      scheduledPlanChange.type === "downgrade" &&
      typeof scheduledPlanChange.effectiveAtMs === "number" &&
      scheduledPlanChange.effectiveAtMs <= now &&
      typeof scheduledPlanChange.targetPlanId === "string" &&
      scheduledPlanChange.targetPlanId === nextPlan;

    const shouldClearStaleFutureScheduledPlanChange =
      scheduledPlanChange &&
      scheduledPlanChange.type === "downgrade" &&
      typeof scheduledPlanChange.effectiveAtMs === "number" &&
      scheduledPlanChange.effectiveAtMs > now &&
      !stripeIndicatesScheduledChange;

    const desiredPlanId = billingActive ? nextPlan : "free";
    const willClearScheduledPlanChange = !!(shouldClearScheduledPlanChange || shouldClearStaleFutureScheduledPlanChange);
    const desiredPendingPlan = preservePendingPlan
      ? (user?.pendingPlan ?? null)
      : billingActive
        ? null
        : (user?.pendingPlan ?? null);

    const pendingPlanCleared = (user?.pendingPlan ?? null) !== null && desiredPendingPlan === null;

    const changes: string[] = [];
    if ((user?.planId ?? "free") !== desiredPlanId) changes.push("updated_planId");
    if ((user?.pendingPlan ?? null) !== desiredPendingPlan && desiredPendingPlan === null) changes.push("cleared_pendingPlan");
    if (willClearScheduledPlanChange && (user?.scheduledPlanChange ?? null) !== null) changes.push("cleared_scheduledPlanChange");
    if (String(user?.billingStatus || "none") !== billingStatus) changes.push("updated_billingStatus");
    if (Boolean(user?.billingActive) !== billingActive) changes.push("updated_billingActive");
    if (Number(user?.billing?.currentPeriodEnd ?? null) !== Number(currentPeriodEnd ?? null)) changes.push("updated_currentPeriodEndMs");
    if (Boolean(user?.billing?.cancelAtPeriodEnd) !== Boolean(sub.cancel_at_period_end)) changes.push("updated_cancelAtPeriodEnd");

    const changed = changes.length > 0;

    await userRef.set(
      {
        planId: desiredPlanId,
        pendingPlan: desiredPendingPlan,
        ...(willClearScheduledPlanChange ? { scheduledPlanChange: null } : {}),
        planChangeHistory: nextHistory,
        planChangeLock: null,
        planChangeRequestId: null,
        planChangeRequestResult: null,
        billingActive,
        billingStatus,
        billing: {
          ...(user?.billing || {}),
          provider: "stripe",
          customerId: customerId ?? sub.customer ?? null,
          subscriptionId: sub.id ?? subscriptionId ?? null,
          priceId,
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          currentPeriodEnd,
          updatedAt: now,
        },
        updatedAt: now,
      },
      { merge: true }
    );

    return res.json({
      success: true,
      planId: desiredPlanId,
      billingStatus,
      billingActive,
      pendingPlanCleared,
      changed,
      changes,
      stripe: {
        subscriptionStatus: billingStatus,
        hasSchedule: stripeIndicatesScheduledChange,
        currentPeriodEndMs: currentPeriodEnd,
      },
    });
  } catch (err: any) {
    console.error("POST /api/billing/refresh failed:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ---------------------------------------------------------------------------
// Overages toggle (Pro-only)
// POST /api/billing/overages
// Body: { enabled: boolean }
// - When enabling, requires Stripe readiness (customer + default payment method)
// - Persists billingSettings.overagesEnabled (plus legacy mirrors)
// ---------------------------------------------------------------------------

router.post(
  "/overages",
  requireAuth,
  createOveragesEndpointHandler({
    getAccount: async (uid) => await getUserAccount(uid),
    getUserDoc: async (uid) => {
      const snap = await getUserRef(uid).get();
      return snap.exists ? ((snap.data() as any) || {}) : null;
    },
    patchUserDoc: async (uid, patch) => {
      await getUserRef(uid).set(patch, { merge: true });
    },
    retrieveStripeCustomer: async (customerId) => await stripe.customers.retrieve(customerId),
    now: () => Date.now(),
  })
);

router.get("/me", requireAuth, async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ error: PERMISSION_ERRORS.UNAUTHORIZED });
    const account = (req as any).account || await getUserAccount(uid);

    const snap = await getUserRef(uid).get();
    const raw = snap.exists ? snap.data() : account.rawUser;
    return res.json({
      id: uid,
      ...raw,
      planId: account.planId,
      billingEnabled: account.billingEnabled,
      platformBillingEnabled: account.platformBillingEnabled,
      effectiveBillingEnabled: account.effectiveBillingEnabled,
      isAdmin: account.isAdmin,
    });
  } catch (err: any) {
    console.error("GET /api/billing/me failed:", err?.message || err);
    return res.status(500).json({ error: "Failed to load user" });
  }
});

// Safely check if a subscription change is scheduled
// Returns: { scheduledChange, effectiveDate, hasSubscription, status, cancelAtPeriodEnd, billingActive }
router.get("/pending-change", requireAuth, async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ error: PERMISSION_ERRORS.UNAUTHORIZED });
    const account = (req as any).account || await getUserAccount(uid);

    const snap = await getUserRef(uid).get();
    if (!snap.exists) return res.status(404).json({ error: "User not found" });
    const user = snap.data() as any;

    const subscriptionId: string | undefined =
      user?.billing?.subscriptionId || user?.stripeSubscriptionId;

    const hasSubscription = !!subscriptionId;
    const billingActive = !!(user?.billingStatus === "active" || user?.billingStatus === "trialing");

    if (!subscriptionId) {
      return res.json({
        scheduledChange: false,
        effectiveDate: null,
        hasSubscription,
        status: user?.billingStatus || "none",
        cancelAtPeriodEnd: false,
        billingActive,
      });
    }

    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const cancelAtPeriodEnd = !!(sub as any).cancel_at_period_end;
    const status = (sub as any).status as string | undefined;
    const currentPeriodEnd = (sub as any).current_period_end
      ? new Date((sub as any).current_period_end * 1000).toISOString()
      : null;

    let scheduledChange = false;
    let effectiveDate: string | null = null;

    // If set to cancel at period end, consider that a scheduled change
    if (cancelAtPeriodEnd) {
      scheduledChange = true;
      effectiveDate = currentPeriodEnd;
    }

    // If there is a schedule attached, treat it as scheduled
    if (!scheduledChange) {
      const scheduleId = (sub as any).schedule || (sub as any).subscription_schedule;
      if (scheduleId) {
        scheduledChange = true;
        // Best-effort: try to read schedule
        try {
          const schedule = await stripe.subscriptionSchedules.retrieve(String(scheduleId));
          const phases = (schedule.phases || []) as any[];
          const last = phases[phases.length - 1];
          if (last?.end_date) {
            effectiveDate = new Date(last.end_date * 1000).toISOString();
          }
        } catch {}
      }
    }

    // Some accounts expose pending_update
    if (!scheduledChange && (sub as any).pending_update) {
      scheduledChange = true;
      effectiveDate = currentPeriodEnd;
    }

    return res.json({
      scheduledChange,
      effectiveDate,
      hasSubscription,
      status,
      cancelAtPeriodEnd,
      billingActive,
    });
  } catch (err: any) {
    console.error("GET /api/billing/pending-change failed:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Comprehensive billing/plan state for UI state machine
router.get("/status", requireAuth, async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ error: PERMISSION_ERRORS.UNAUTHORIZED });
    const account = (req as any).account || await getUserAccount(uid);

    const snap = await getUserRef(uid).get();
    if (!snap.exists) return res.status(404).json({ error: "User not found" });
    const user = snap.data() as any;

    const now = Date.now();
    const lock = user?.planChangeLock || null;

    const guards = normalizeBillingGuards(user?.billingGuards, now);
    const daily = assertDailyPlanLimit(guards, now);
    const dailyRemaining = daily.ok ? Math.max(0, 3 - (guards.changeCountInWindow ?? 0)) : 0;

    const subscriptionId: string | undefined =
      user?.billing?.subscriptionId || user?.stripeSubscriptionId;

    let cancelAtPeriodEnd = false;
    let status: string | undefined = user?.billingStatus;
    let billingActive = !!(user?.billingStatus === "active" || user?.billingStatus === "trialing");
    let scheduledChange = false;
    let scheduledEffectiveDate: string | null = null;

    if (subscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        cancelAtPeriodEnd = !!(sub as any).cancel_at_period_end;
        status = (sub as any).status as string | undefined;
        billingActive = status === "active" || status === "trialing";

        const currentPeriodEnd = (sub as any).current_period_end
          ? new Date((sub as any).current_period_end * 1000).toISOString()
          : null;

        if (cancelAtPeriodEnd) {
          scheduledChange = true;
          scheduledEffectiveDate = currentPeriodEnd;
        }

        const scheduleId = (sub as any).schedule || (sub as any).subscription_schedule;
        if (!scheduledChange && scheduleId) {
          scheduledChange = true;
          try {
            const schedule = await stripe.subscriptionSchedules.retrieve(String(scheduleId));
            const phases = (schedule.phases || []) as any[];
            const last = phases[phases.length - 1];
            if (last?.end_date) {
              scheduledEffectiveDate = new Date(last.end_date * 1000).toISOString();
            }
          } catch {}
        }

        if (!scheduledChange && (sub as any).pending_update) {
          scheduledChange = true;
          scheduledEffectiveDate = currentPeriodEnd;
        }
      } catch (err: any) {
        console.error("GET /api/billing/status subscription fetch failed:", err?.message || err);
      }
    }

    const planId = user?.planId || "free";
    const pendingPlan = user?.pendingPlan ?? null;
    const scheduledPlanChange = user?.scheduledPlanChange ?? null;

    let state: string = "ACTIVE";
    if (cancelAtPeriodEnd) {
      state = "CANCEL_AT_PERIOD_END";
    } else if (
      scheduledPlanChange &&
      scheduledPlanChange.type === "downgrade" &&
      typeof scheduledPlanChange.effectiveAtMs === "number" &&
      scheduledPlanChange.effectiveAtMs > now
    ) {
      state = "PENDING_DOWNGRADE";
    } else if (scheduledChange) {
      if (pendingPlan && pendingPlan !== planId) {
        state = comparePlans(planId, pendingPlan) > 0 ? "PENDING_UPGRADE" : "PENDING_DOWNGRADE";
      } else {
        state = "PENDING_CHANGE";
      }
    }

    const lockStale = lock?.expiresAt && lock.expiresAt < now - PLAN_CHANGE_LOCK_TTL_MS;
    if (!subscriptionId && billingActive) {
      state = "ERROR_NEEDS_SUPPORT";
    } else if (lockStale && state === "ACTIVE") {
      state = "ERROR_NEEDS_SUPPORT";
    }

    const history = sanitizeHistory(user?.planChangeHistory);

    return res.json({
      success: true,
      state,
      planId,
      pendingPlan,
      scheduledPlanChange,
      billingStatus: status || null,
      billingActive,
      subscriptionId: subscriptionId || null,
      scheduledChange,
      scheduledEffectiveDate,
      cancelAtPeriodEnd,
      guards: {
        changeWindowStartMs: guards.changeWindowStartMs,
        changeCountInWindow: guards.changeCountInWindow,
        lastDowngradeAtMs: guards.lastDowngradeAtMs,
        lastPlanChangeAtMs: guards.lastPlanChangeAtMs,
      },
      daily: {
        remaining: dailyRemaining,
        retryAfterMs: daily.ok ? 0 : (daily as any).retryAfterMs,
      },
      lock: lock || null,
      request: {
        lastRequestId: user?.planChangeRequestId ?? null,
        lastResult: user?.planChangeRequestResult ?? null,
      },
      history,
    });
  } catch (err: any) {
    console.error("GET /api/billing/status failed:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
