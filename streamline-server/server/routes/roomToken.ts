import express from "express";
import { AccessToken } from "livekit-server-sdk";
import { firestore } from "../firebaseAdmin";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { roomName, identity, uid } = req.body as {
      roomName?: string;
      identity?: string;
      uid?: string;
    };

    if (!uid) {
      return res.status(400).json({ error: "uid is required" });
    }

    // -----------------------------
    // 1. Load user + plan + usage
    // -----------------------------
    const userSnap = await firestore.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "user not found" });
    }
    const userData = userSnap.data() as any;

    const planId = userData.planId || "free";

    const planSnap = await firestore.doc(`plans/${planId}`).get();
    const planData = (planSnap.exists ? planSnap.data() : {}) as any;

    // max hours allowed from plan document
    const maxHoursFromPlan: number =
      planData.maxHoursPerMonth ?? planData.monthlyHours ?? 0;

    // current month key for usage
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    const usageRef = firestore.doc(`usage/${uid}_${monthKey}`);
    const usageSnap = await usageRef.get();
    const usage = (usageSnap.exists ? usageSnap.data() : {}) as any;

    const usedMinutes = usage.totalMinutes || 0;
    const usedHours = usedMinutes / 60;
    const maxHours = maxHoursFromPlan || 0;

    // --------------------------------------------
    // 2. Enforce monthly streaming limit per plan
    // --------------------------------------------
    if (maxHours > 0 && usedHours >= maxHours) {
      return res.status(403).json({
        code: "USAGE_LIMIT",
        message: "You've reached your monthly streaming limit.",
      });
    }

    // --------------------------------------------
    // 3. Generate LiveKit token (existing behavior)
    // --------------------------------------------
    const room = roomName || "default";
    const userIdentity = identity || "Guest";

    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL; // LiveKit server URL

    if (!key || !secret || !url) {
      console.error("Missing LiveKit env vars");
      return res.status(500).json({ error: "server not configured" });
    }

    const at = new AccessToken(key, secret, {
      identity: userIdentity,
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return res.json({
      token,
      serverUrl: url,
    });
  } catch (err) {
    console.error("roomToken error", err);
    return res.status(500).json({ error: "internal error" });
  }
});

export default router;
