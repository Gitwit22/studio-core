import { Router } from "express";
import { stripe } from "../lib/stripe";
import { firestore as db } from "../firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth"; // adjust path/name if yours differs

const router = Router();

function priceIdFor(plan: "starter" | "pro") {
  return plan === "starter"
    ? process.env.STRIPE_PRICE_STARTER!
    : process.env.STRIPE_PRICE_PRO!;
}

router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const { plan } = req.body as { plan: "starter" | "pro" };
    if (plan !== "starter" && plan !== "pro") {
      return res.status(400).json({ success: false, error: "Invalid plan" });
    }

    const userRef = db.collection("users").doc(userId);
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "User not found" });

    const user = snap.data() as any;

    // 1) Ensure Stripe customer exists
    let customerId = user?.billing?.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email,
        name: user?.displayName,
        metadata: { userId },
      });
      customerId = customer.id;

      await userRef.set(
        {
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

    const CLIENT_URL = process.env.CLIENT_URL!;
    const trialDays = Number(process.env.STARTER_TRIAL_DAYS || "7");

    // 3) Create checkout session (subscription)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdFor(plan), quantity: 1 }],

      success_url: `${CLIENT_URL}/billing/success`,
      cancel_url: `${CLIENT_URL}/billing/canceled`,

      metadata: { userId, plan },

      // IMPORTANT: put metadata on subscription too (webhook uses subscription events)
      subscription_data: {
        metadata: { userId, plan },
        ...(plan === "starter" ? { trial_period_days: trialDays } : {}),
      },
    });

    return res.json({ success: true, url: session.url });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

router.post("/portal", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const snap = await db.collection("users").doc(userId).get();
    const user = snap.data() as any;

    const customerId = user?.billing?.customerId;
    if (!customerId) return res.status(400).json({ success: false, error: "No Stripe customer" });

    const CLIENT_URL = process.env.CLIENT_URL!;
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${CLIENT_URL}/settings/billing`,
    });

    return res.json({ success: true, url: portal.url });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const snap = await db.collection("users").doc(userId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = snap.data();

    return res.json({
      id: userId,
      ...user,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load user" });
  }
});

export default router;
