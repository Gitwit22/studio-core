import express from "express";
import { firestore } from "../firebaseAdmin";

const router = express.Router();

// Public stats for landing page
router.get("/public", async (_req, res) => {
  try {
    // Run both queries in parallel for speed
    const [usersSnap, usageSnap] = await Promise.all([
      firestore.collection("users").get(),
      firestore.collection("usageMonthly").get(),
    ]);

    // Total registered users (streamers)
    const streamers = usersSnap.size;

    // Sum participant minutes from usageMonthly
    let totalMinutes = 0;
    usageSnap.docs.forEach((doc) => {
      const data = doc.data() as any;
      const usage = data?.usage || data?.totals || {};
      const participantMinutes = Number(
        usage?.participantMinutes ?? usage?.streamMinutes ?? usage?.minutes ?? 0
      );
      totalMinutes += participantMinutes;
    });

    const hoursStreamed = Math.floor(totalMinutes / 60);

    return res.json({
      streamers,
      hoursStreamed,
      minutesStreamed: totalMinutes,
    });
  } catch (err: any) {
    console.error("stats/public error:", err);
    return res.status(500).json({ error: "failed_to_load_stats" });
  }
});

export default router;
