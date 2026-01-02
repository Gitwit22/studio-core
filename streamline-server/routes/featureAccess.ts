import { firestore as db } from "../firebaseAdmin";

type AccessResult = {
  allowed: boolean;
  reason?: string;
};

const BAD_BILLING_STATUSES = new Set([
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "canceled",
]);

function isPaidPlan(planId?: string) {
  return planId === "starter" || planId === "pro";
}

function billingBlocks(user: any): string | null {
  const planId = user?.planId;
  const billingStatus = user?.billingStatus;
  const billingActive = user?.billingActive;

  if (!isPaidPlan(planId)) {
    return null; // free users don’t need billing
  }

  // Missing subscription is a hard block
  const subscriptionId =
    user?.stripeSubscriptionId || user?.billing?.subscriptionId;
  if (!subscriptionId) {
    return "Missing subscription";
  }

  if (billingActive === false) {
    return "Billing inactive";
  }

  if (billingStatus && BAD_BILLING_STATUSES.has(String(billingStatus))) {
    return `Billing ${billingStatus}`;
  }

  // Paid plan but no billing status is suspicious → block
  if (!billingStatus) {
    return "Missing billing status";
  }

  return null; // billing OK
}

export async function canAccessFeature(
  uid: string,
  featureKey: string
): Promise<AccessResult> {
  // 1) Load user
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    return { allowed: false, reason: "User not found" };
  }

  const user = userSnap.data() as any;
  const planId = user?.planId || "free";

  // 2) STRICT BILLING BLOCK (NEW)
  const billingBlockReason = billingBlocks(user);
  if (billingBlockReason) {
    return {
      allowed: false,
      reason: `Billing issue: ${billingBlockReason}`,
    };
  }

  // 3) Load plan
  const planSnap = await db.collection("plans").doc(planId).get();
  if (!planSnap.exists) {
    return { allowed: false, reason: "Plan not found" };
  }

  const plan = planSnap.data() as any;

  // 4) Feature flag check
  const enabled = Boolean(plan?.features?.[featureKey]);

  if (!enabled) {
    return {
      allowed: false,
      reason: "Feature not available on your plan",
    };
  }

  return { allowed: true };
}
