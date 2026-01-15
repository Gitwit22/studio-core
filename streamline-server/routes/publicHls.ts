import { Router } from "express";
import { getRoom } from "../services/rooms";

const router = Router();

// Public viewer-safe endpoint: no auth, tiny payload.
// GET /api/public/hls/:roomId -> { status, playlistUrl }
router.get("/:roomId", async (req: any, res) => {
  const roomId = req.params.roomId;
  try {
    const { data: room } = await getRoom(roomId);
    const hls = room.hls || {};

    const isLive = hls.status === "live" && !!(hls.playlistUrl && String(hls.playlistUrl).trim());

    return res.json({
      status: isLive ? "live" : "idle",
      playlistUrl: isLive ? hls.playlistUrl : null,
    });
  } catch (e: any) {
    if (e?.message === "room_not_found") {
      return res.status(404).json({ error: "room_not_found" });
    }
    console.error("Public HLS status error", e);
    return res.status(500).json({ error: "Failed to fetch HLS status" });
  }
});

export default router;
