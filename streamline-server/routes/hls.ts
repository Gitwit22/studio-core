import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getRoom, setHlsError, setHlsLive, setHlsStarting } from "../services/rooms";
import { startHlsEgress, HlsPresetId } from "../services/livekitEgress";

const router = Router();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

router.get("/ping", (req, res) => res.send("hls ok"));

router.post("/start/:roomId", requireAuth as any, async (req: any, res) => {
  const roomId = req.params.roomId;

  const userId = req.user?.uid;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const presetId = (req.body?.presetId || "hls_720p") as HlsPresetId;

  const { ref: roomRef, data: room } = await getRoom(roomId);

  if (room.ownerId !== userId) return res.status(403).json({ error: "Forbidden" });
  if (room.roomType !== "rtc") return res.status(400).json({ error: "roomType must be rtc" });

  // IDEMPOTENT: if already starting/live, just return what we have
  const status = room.hls?.status || "idle";
  if (status === "starting" || status === "live") {
    return res.json({
      roomId,
      status,
      egressId: room.hls?.egressId || null,
      playlistUrl: room.hls?.playlistUrl || null,
    });
  }

  // Build stable paths
  const prefix = `hls/${roomId}/`;
  const playlistName = `room.m3u8`;
  const publicBase = requireEnv("HLS_PUBLIC_BASE_URL");
  const playlistUrl = `${publicBase}/${roomId}/${playlistName}`;

  const lkRoomName = room.livekitRoomName || roomId;

  // 1) Mark starting first (crash-safe)
  await setHlsStarting(roomRef, { presetId, prefix });

  try {
    // 2) Start egress
    const { egressId } = await startHlsEgress({
      roomName: lkRoomName,
      layout: "speaker",
      prefix,
      playlistName,
      segmentDurationSec: 6,
      presetId,
    });

    // 3) Mark live + store URLs
    await setHlsLive(roomRef, { egressId, playlistUrl });

    return res.json({
      roomId,
      status: "live",
      egressId,
      playlistUrl,
    });
  } catch (e: any) {
    await setHlsError(roomRef, e?.message || "Failed to start HLS egress");
    return res.status(500).json({ error: "Failed to start HLS egress", details: e?.message });
  }
});

export default router;
