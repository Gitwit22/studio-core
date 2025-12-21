import express from "express";
import { firestore } from "../firebaseAdmin";
import { EgressClient, EncodedFileOutput, RoomCompositeEgressRequest, EncodedFileType, } from "livekit-server-sdk";
import { S3Upload } from "livekit-server-sdk";

// import { startLiveKitRecording, stopLiveKitRecording, getRecordingStreamFromR2 } from "../lib/recordingService";

const router = express.Router();

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// POST /api/recordings/start
router.post("/start", async (req, res) => {
  const { roomName, layout } = req.body;
  if (!roomName) {
    return res.status(400).json({ error: "roomName is required" });
  }
  try {
    // TODO: Call LiveKit egress API to start recording
    const LIVEKIT_URL = mustGetEnv("LIVEKIT_URL");
    const LIVEKIT_API_KEY = mustGetEnv("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = mustGetEnv("LIVEKIT_API_SECRET");

    const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    const output = new EncodedFileOutput({
  fileType: EncodedFileType.MP4,
  filepath: `recordings/${roomName}/rec_${Date.now()}.mp4`,
  output: {
    case: "s3",
    value: new S3Upload({
      accessKey: mustGetEnv("R2_ACCESS_KEY_ID"),
      secret: mustGetEnv("R2_SECRET_ACCESS_KEY"),
      bucket: mustGetEnv("R2_BUCKET"),
      endpoint: mustGetEnv("R2_ENDPOINT"),
      region: process.env.R2_REGION ?? "auto",
      forcePathStyle: true,
    }),
  },
});

    const info = await egressClient.startRoomCompositeEgress(
      roomName,
      output,
      {
        layout: layout === "speaker" ? "speaker" : "grid",
      }
    );

    const egressId = info.egressId;

    await firestore.collection("recordings").doc(egressId).set({
      roomName,
      layout: layout || null,
      status: "STARTED",
      createdAt: new Date(),
    });
    return res.json({ recordingId: egressId });
  } catch (err) {
    return res.status(500).json({ error: "Failed to start recording", details: err?.message });
  }
});

// POST /api/recordings/stop
router.post("/stop", async (req, res) => {
  const { recordingId } = req.body;
  if (!recordingId) {
    return res.status(400).json({ error: "recordingId is required" });
  }
  try {
    const LIVEKIT_URL = mustGetEnv("LIVEKIT_URL");
    const LIVEKIT_API_KEY = mustGetEnv("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = mustGetEnv("LIVEKIT_API_SECRET");

    const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    await egressClient.stopEgress(recordingId);

    await firestore.collection("recordings").doc(recordingId).set(
      {
        status: "STOP_REQUESTED",
        stoppedAt: new Date(),
      },
      { merge: true }
    );

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to stop recording", details: err?.message });
  }
});

// GET /api/recordings/:id/download?token=...
router.get("/:id/download", async (req, res) => {
  const { id } = req.params;
  const { token } = req.query;
  if (!id || !token) {
    return res.status(400).json({ error: "id and token are required" });
  }
  try {
    // TODO: Validate token, stream from R2, then delete
    // const stream = await getRecordingStreamFromR2(id, token);
    // stream.pipe(res);
    res.status(501).json({ error: "Download not implemented yet" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to download recording", details: err?.message });
  }
});

export default router;
