// server/index.ts (or routes/usageRoutes.ts)
import express from "express";
import { firestore } from "../firebaseAdmin";
 // your initialized admin SDK

const app = express();
app.post("/api/usage/streamEnded", async (req, res) => {
  try {
    const { uid, minutes = 0, guestCount = 0 } = req.body as {
      uid?: string;
      minutes?: number;
      guestCount?: number;
    };

    if (!uid) {
      return res.status(400).json({ error: "uid required" });
    }

    // Normalize minutes
    const safeMinutes = Math.max(0, Number(minutes) || 0);

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    const usageRef = firestore.doc(`usage/${uid}_${monthKey}`);
    const snap = await usageRef.get();
    const existing = snap.exists ? (snap.data() as any) : {};

    const totalMinutes = (existing.totalMinutes || 0) + safeMinutes;
    const ytdMinutes = (existing.ytdMinutes || 0) + safeMinutes;

    await usageRef.set(
      {
        totalMinutes,
        ytdMinutes,
        lastUpdated: now.toISOString(),
        lastGuestCount: guestCount,
      },
      { merge: true }
    );

    return res.json({ ok: true, totalMinutes, ytdMinutes });
  } catch (err) {
    console.error("streamEnded error", err);
    return res.status(500).json({ error: "internal error" });
  }
});

app.get("/api/usage/summary", async (req, res) => {
  try {
    const uid =
  (req.query.uid as string | undefined) || (req as any).uid;

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
    const usedHours = usage.hoursStreamedThisMonth || 0;
    const ytdHours = usage.ytdHours || 0;

    

    // if you want to allow per-user overrides, use usage.maxHours first:
    const maxHours =
      (usage.maxHours && usage.maxHours > 0
        ? usage.maxHours
        : maxHoursFromPlan) || 0;

// ----------------------------------------------
// Compute resetDate based on user.createdAt date
// ----------------------------------------------
let resetDate: string | null = null;

if (userData.createdAt) {
  const createdAtDate = new Date(userData.createdAt);
  const createdDay = createdAtDate.getDate();

  const now = new Date();
  const thisMonthReset = new Date(
    now.getFullYear(),
    now.getMonth(),
    createdDay
  );

  const nextMonthReset = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    createdDay
  );

  // If today's date is past this month's reset day,
  // next reset is next month. Otherwise it's this month.
  const finalReset =
    now.getDate() >= createdDay ? nextMonthReset : thisMonthReset;

  resetDate = finalReset.toISOString();
}




    return res.json({
  displayName: userData.displayName || "",
  planId,
  usedHours,
  maxHours,
  resetDate,
  ytdHours,
  // extra plan info for UI:
  maxGuests,
  multistreamEnabled,
   priceWeekly: planData.priceWeekly || 0,
  priceMonthly: planData.priceMonthly || 0,
  priceYearly: planData.priceYearly || 0,
});

  } catch (err) {
    console.error("usage summary error", err);
    return res.status(500).json({ error: "internal error" });
  }

  
});
