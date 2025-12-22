import express from "express";
import { firestore } from "../firebaseAdmin";
import { EgressClient, EncodedFileOutput, EncodedFileType } from "livekit-server-sdk";
import { S3Upload } from "livekit-server-sdk";
import crypto from "crypto";
import { r2GetStream, r2Delete } from "../lib/r2";

const router = express.Router();

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// IMPORTANT: More specific routes MUST come before generic ones!
// GET /api/recordings/:id/download - Must be FIRST (most specific)
router.get("/:id/download", async (req, res) => {
  const { id } = req.params;
  const token = String(req.query.token || "");

  if (!id || !token) {
    return res.status(400).json({ error: "id and token are required" });
  }

  try {
    const snap = await firestore.collection("recordings").doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: "Recording not found" });

    const data = snap.data() as any;

    // Must be ready + have file key
    if (data.status !== "READY" || !data.objectKey) {
      return res.status(409).json({ error: "Recording not ready yet" });
    }

    // Validate token (sha256)
    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    if (!data.oneTimeToken || hashed !== data.oneTimeToken) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Stream from R2
    const body = await r2GetStream(data.objectKey);
    if (!body) return res.status(404).json({ error: "File not found in storage" });

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${id}.mp4"`);

    // Pipe stream
    (body as any).pipe(res);

    // Optional: one-time cleanup AFTER response finishes
    res.on("finish", async () => {
      try {
        // delete file + invalidate token
        await r2Delete(data.objectKey);
        await firestore.collection("recordings").doc(id).set(
          { oneTimeToken: null, status: "DOWNLOADED", downloadedAt: new Date() },
          { merge: true }
        );
      } catch (e) {
        console.error("[download] cleanup failed:", e);
      }
    });
  } catch (err: any) {
    console.error("Download failed:", err);
    return res.status(500).json({ error: "Failed to download recording", details: err?.message });
  }
});

// GET /api/recordings/:id - Get recording status (comes AFTER /download)
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  
  console.log(`📋 GET /api/recordings/${id} - Fetching recording status`);
  
  if (!id) {
    return res.status(400).json({ error: "Recording ID is required" });
  }
  
  try {
    const snap = await firestore.collection("recordings").doc(id).get();
    
    if (!snap.exists) {
      console.log(`❌ Recording ${id} not found in Firestore`);
      return res.status(404).json({ error: "Recording not found" });
    }
    
    const data = snap.data();
    
    console.log(`✅ Recording ${id} status:`, data?.status);
    
    return res.status(200).json({
      id: id,
      status: data?.status || "PROCESSING",
      roomName: data?.roomName,
      objectKey: data?.objectKey,
      createdAt: data?.createdAt,
      updatedAt: data?.updatedAt,
      endedAt: data?.endedAt,
      layout: data?.layout,
      downloadReady: data?.status === "READY" && !!data?.objectKey
    });
    
  } catch (err: any) {
    console.error(`❌ Failed to fetch recording ${id}:`, err);
    return res.status(500).json({ 
      error: "Failed to fetch recording", 
      details: err?.message || String(err)
    });
  }
});

// POST /api/recordings/start
router.post("/start", async (req, res) => {
  const { roomName, layout } = req.body as {
    roomName?: string;
    layout?: "speaker" | "grid";
  };

  console.log("🎬 /api/recordings/start called:", { roomName, layout });

  if (!roomName) {
    return res.status(400).json({ ok: false, error: "roomName is required" });
  }

  // default layout if missing
  const chosenLayout: "speaker" | "grid" = layout === "speaker" ? "speaker" : "grid";

  try {
    // Get environment variables
    const LIVEKIT_URL = mustGetEnv("LIVEKIT_URL");
    const LIVEKIT_API_KEY = mustGetEnv("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = mustGetEnv("LIVEKIT_API_SECRET");

    console.log("🔑 Environment variables loaded");

    const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    const filepath = `recordings/${roomName}/rec_${Date.now()}.mp4`;

    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath,
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

    // IMPORTANT: start egress and ALWAYS return JSON
  
    const info = await egressClient.startRoomCompositeEgress(roomName, {
  file: output,
});


    // LiveKit SDK returns an egressId; normalize it
    const recordingId =
      (info as any)?.egressId ||
      (info as any)?.egressInfo?.egressId ||
      (info as any)?.info?.egressId;

    if (!recordingId) {
      console.warn("⚠️ startRoomCompositeEgress returned no egressId:", info);
      return res.status(500).json({ ok: false, error: "Egress started but no recordingId returned" });
    }

    console.log("✅ Recording started:", { recordingId, roomName, layout: chosenLayout, filepath });

    // Write Firestore doc immediately
    await firestore.collection("recordings").doc(recordingId).set(
      {
        roomName,
        layout: chosenLayout,
        status: "RECORDING",
        objectKey: null,
        filepath,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      recordingId,
      roomName,
      layout: chosenLayout,
      filepath,
    });
  } catch (err: any) {
    console.error("❌ /api/recordings/start failed:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Failed to start recording",
    });
  }
});


// (Removed unreachable duplicate code block that referenced undefined variables)

// POST /api/recordings/stop
router.post("/stop", async (req, res) => {
  const { recordingId } = req.body;
  
  console.log("⏹️ /api/recordings/stop called:", { recordingId });
  
  if (!recordingId) {
    return res.status(400).json({ error: "recordingId is required" });
  }
  
  try {
    const LIVEKIT_URL = mustGetEnv("LIVEKIT_URL");
    const LIVEKIT_API_KEY = mustGetEnv("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = mustGetEnv("LIVEKIT_API_SECRET");

    const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    await egressClient.stopEgress(recordingId);

    console.log("✅ Egress stopped successfully");

    await firestore.collection("recordings").doc(recordingId).set(
      {
        status: "STOP_REQUESTED",
        stoppedAt: new Date(),
      },
      { merge: true }
    );

    console.log("💾 Recording status updated to STOP_REQUESTED");

    return res.status(200).json({ ok: true });
    
  } catch (err: any) {
    console.error("❌ Failed to stop recording:", err);
    return res.status(500).json({ 
      error: "Failed to stop recording", 
      details: err?.message || String(err)
    });
  }
});

export default router;