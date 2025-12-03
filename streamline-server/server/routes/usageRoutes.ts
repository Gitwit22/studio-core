// server/index.ts (or routes/usageRoutes.ts)
import express from "express";
import { firestore } from "../firebaseAdmin";
 // your initialized admin SDK

const app = express();

app.get("/api/usage/summary", async (req, res) => {
  try {
    const uid = (req as any).uid; // however you attach auth user to req
    if (!uid) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const userRef = firestore.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "user not found" });
    }

    const userData = userSnap.data() || {};
    const usage = (userData.usage || {}) as any;

    const planId: string = userData.plan || "free";

    // ---- read the plan doc from /plans/{planId} ----
    const planRef = firestore.collection("plans").doc(planId);
    const planSnap = await planRef.get();

    if (!planSnap.exists) {
      return res.status(500).json({ error: `plan ${planId} not found` });
    }

    const planData = planSnap.data() || {};
    const maxHoursFromPlan = planData.maxHoursPerMonth || 0;
    const maxGuests = planData.maxGuests || 0;
    const multistreamEnabled = !!planData.multistreamEnabled;

    const now = new Date();
    const resetDateTs = usage.resetDate;
    const resetDate =
      resetDateTs && resetDateTs.toDate ? resetDateTs.toDate() : null;

    // ---- if the period is over, reset monthly usage ----
    if (resetDate && resetDate < now) {
      const nextReset = new Date();
      nextReset.setMonth(nextReset.getMonth() + 1);

      await userRef.update({
        "usage.hoursStreamedThisMonth": 0,
        "usage.periodStart": now,
        "usage.resetDate": nextReset,
      });

      usage.hoursStreamedThisMonth = 0;
      usage.periodStart = now;
      usage.resetDate = nextReset;
    }

    const usedHours = usage.hoursStreamedThisMonth || 0;
    const ytdHours = usage.ytdHours || 0;

    // if you want to allow per-user overrides, use usage.maxHours first:
    const maxHours =
      (usage.maxHours && usage.maxHours > 0
        ? usage.maxHours
        : maxHoursFromPlan) || 0;

    return res.json({
      displayName: userData.displayName || "",
      planId,
      usedHours,
      maxHours,
      resetDate: usage.resetDate || null,
      ytdHours,
      // extra plan info for UI:
      maxGuests,
      multistreamEnabled,
      priceMonthly: planData.priceMonthly || 0,
      priceYearly: planData.priceYearly || 0,
    });
  } catch (err) {
    console.error("usage summary error", err);
    return res.status(500).json({ error: "internal error" });
  }
});
