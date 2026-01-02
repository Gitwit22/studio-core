import { Router } from "express";
import { stripe } from "../lib/stripe";
import { firestore as db } from "../firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();
const CLIENT_URL = process.env.CLIENT_URL!;

function priceIdFor(plan: "starter" | "pro") {
  const id =
    plan === "starter"
      ? process.env.STRIPE_PRICE_STARTER
      : process.env.STRIPE_PRICE_PRO;

  if (!id) throw new Error(`Missing Stripe price env for plan=${plan}`);
  return id;
}

router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.uid; // ✅ FIX
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const { plan } = (req.body || {}) as { plan?: "starter" | "pro" }; // ✅ guard
    if (plan !== "starter" && plan !== "pro") {
      return res.status(400).json({ success: false, error: "Invalid plan" });
    }

    const userRef = db.collection("users").doc(userId);
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "User not found" });

    const user = snap.data() as any;

    // 1) Ensure Stripe customer exists
    let customerId = user?.stripeCustomerId || user?.billing?.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email,
        name: user?.displayName,
        metadata: { userId },
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

    // 2) Store pendingPlan (prevents "select pro but never pay" abuse)
    await userRef.set({ pendingPlan: plan }, { merge: true });

    const CLIENT_URL = process.env.CLIENT_URL;
    if (!CLIENT_URL) throw new Error("Missing env var: CLIENT_URL");

    const trialDays = Number(process.env.STARTER_TRIAL_DAYS || "7");

    // 3) Create checkout session (subscription)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdFor(plan), quantity: 1 }],

      // ✅ simpler MVP
      success_url: `${CLIENT_URL}/settings/billing?success=1`,
      cancel_url: `${CLIENT_URL}/settings/billing?canceled=1`,

      metadata: { userId, plan },

      subscription_data: {
        metadata: { userId, plan },
        ...(plan === "starter" ? { trial_period_days: trialDays } : {}), // ✅ no pro trials
      },
    });

    return res.json({ success: true, url: session.url });
  } catch (err: any) {
    console.error("POST /api/billing/checkout failed:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

router.post("/portal", requireAuth, async (req, res) => {
  try {
const userId = (req as any).user?.id || (req as any).user?.uid;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const snap = await db.collection("users").doc(userId).get();
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

router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.uid; // ✅ FIX
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const snap = await db.collection("users").doc(userId).get();
    if (!snap.exists) return res.status(404).json({ error: "User not found" });

    return res.json({ id: userId, ...snap.data() });
  } catch (err: any) {
    console.error("GET /api/billing/me failed:", err?.message || err);
    return res.status(500).json({ error: "Failed to load user" });
  }
});

export default router;
