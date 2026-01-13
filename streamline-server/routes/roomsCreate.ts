import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { firestore as db } from "../firebaseAdmin";

const router = Router();

/**
 * POST /api/rooms
 * Creates a Firestore room doc if it doesn't exist (idempotent).
 * Body: { roomId?: string, roomType?: "rtc" | "hls", livekitRoomName?: string }
 */
router.post("/rooms", requireAuth as any, async (req: any, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const roomId = (req.body?.roomId || "").trim();
  if (!roomId) return res.status(400).json({ error: "roomId required" });

  const roomType = (req.body?.roomType || "rtc") as "rtc" | "hls";
  const livekitRoomName = (req.body?.livekitRoomName || roomId).trim();

  const ref = db.collection("rooms").doc(roomId);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      ownerId: uid,
      roomType,
      livekitRoomName,
      createdAt: Date.now(),
      hls: { status: "idle" },
    });
  } else {
    const data = snap.data() || {};
    const patch: any = {};
    if (!data.ownerId) patch.ownerId = uid;
    if (!data.roomType) patch.roomType = roomType;
    if (!data.livekitRoomName) patch.livekitRoomName = livekitRoomName;
    if (!data.hls) patch.hls = { status: "idle" };
    if (Object.keys(patch).length) await ref.set(patch, { merge: true });
  }

  return res.json({ ok: true, roomId, livekitRoomName, roomType });
});

export default router;
