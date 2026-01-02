import express from "express";
import Stripe from "stripe";
import { firestore as db } from "../firebaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});
console.log("⚡ Stripe webhook hit");

const router = express.Router();
router.get("/ping", (req, res) => res.status(200).json({ ok: true }));

// IMPORTANT: raw body only
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error("Stripe signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;

      if (!userId || !planId) {
        console.error("Missing metadata on checkout session");
        return res.status(400).json({ error: "Missing metadata" });
      }

      await db.collection("users").doc(userId).set(
        {
          planId,
          pendingPlan: null,
          billingActive: true,
          billingStatus: "active",
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    res.json({ received: true });
  }
);

export default router;
