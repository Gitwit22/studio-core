import { Router } from "express";
import { firestore } from "../firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { canAccessFeature } from "./featureAccess";

const router = Router();

router.post("/start", requireAuth, async (req, res) => {
  try {
    const uid = (req as any).user?.uid || (req as any).user?.id;

    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Feature access gate
    const access = await canAccessFeature(uid, "recording");
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: access.reason || "Recording requires upgrade" });
    }

    // Load user
    const userSnap = await firestore.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = userSnap.data()!;
    const planId = user.planId || "free";

    // Load plan
    const planSnap = await firestore.collection("plans").doc(planId).get();
    if (!planSnap.exists) {
      return res.status(403).json({ error: "Invalid plan" });
    }

    const plan = planSnap.data()!;
    // You can use plan data here in the future if recording tiers differ

    const { roomName, layout } = req.body as {
      roomName?: string;
      layout?: "speaker" | "grid" | string;
    };

    if (!roomName) {
      return res.status(400).json({ error: "roomName is required" });
    }

    const now = new Date();
    const recordingRef = firestore.collection("recordings").doc();
    const recordingId = recordingRef.id;

    const recordingData = {
      id: recordingId,
      userId: uid,
      roomName,
      layout: (layout as any) || "grid",
      status: "recording",
      startedAt: now,
      stoppedAt: null as Date | null,
      duration: 0,
      viewerCount: 0,
      peakViewers: 0,
      createdAt: now,
      updatedAt: now,
    };

    await recordingRef.set(recordingData);

    return res.json({
      success: true,
      recordingId,
      recording: recordingData,
    });
  } catch (err) {
    console.error("recording error:", err);
    return res.status(500).json({ error: "Failed to start recording" });
  }
});

export default router;
