import express from "express";
import { firestore } from "../firebaseAdmin";
import { EgressClient, EncodedFileOutput, EncodedFileType, EgressInfo } from "livekit-server-sdk";
import { S3Upload } from "livekit-server-sdk";
import crypto from "crypto";
import { r2GetStream, r2Delete } from "../lib/r2";

const router = express.Router();

router.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  next();
});


function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// =============================================================================
// DOWNLOAD RECORDING
// =============================================================================

router.get("/:id/download", async (req, res) => {
  const { id } = req.params;
  const token = String(req.query.token || "");

  if (!id || !token) {
    return res.status(400).json({
      success: false,
      error: "id and token are required",
    });
  }

  try {
    const snap = await firestore.collection("recordings").doc(id).get();
    
    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: "Recording not found",
      });
    }

    const data = snap.data() as any;

    if (data.status !== "READY" || !data.objectKey) {
      return res.status(409).json({
        success: false,
        error: "Recording not ready yet",
      });
    }

    // Validate token (sha256)
    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    if (!data.oneTimeToken || hashed !== data.oneTimeToken) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    }

    // Stream from R2
    const body = await r2GetStream(data.objectKey);
    if (!body) {
      return res.status(404).json({
        success: false,
        error: "File not found in storage",
      });
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${id}.mp4"`);

    // Pipe stream - NO JSON RESPONSE HERE
    (body as any).pipe(res);

    // Cleanup after stream finishes
    res.on("finish", async () => {
      try {
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
    return res.status(500).json({
      success: false,
      error: "Failed to download recording",
      details: err?.message,
    });
  }
});

// =============================================================================
// GET RECORDING STATUS
// =============================================================================

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  
  console.log(`📋 GET /api/recordings/${id} - Fetching recording status`);
  
  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Recording ID is required",
    });
  }
  
  try {
    const snap = await firestore.collection("recordings").doc(id).get();
    
    if (!snap.exists) {
      console.log(`❌ Recording ${id} not found in Firestore`);
      return res.status(404).json({
        success: false,
        error: "Recording not found",
      });
    }
    
    const data = snap.data();
    console.log(`✅ Recording ${id} status:`, data?.status);
    
    return res.status(200).json({
      success: true,
      data: {
        id: id,
        status: data?.status || "PROCESSING",
        roomName: data?.roomName,
        objectKey: data?.objectKey,
        createdAt: data?.createdAt,
        updatedAt: data?.updatedAt,
        endedAt: data?.endedAt,
        layout: data?.layout,
        downloadReady: data?.status === "READY" && !!data?.objectKey,
      },
    });
    
  } catch (err: any) {
    console.error(`❌ Failed to fetch recording ${id}:`, err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch recording",
      details: err?.message || String(err),
    });
  }
});

// =============================================================================
// START RECORDING
// =============================================================================

router.post("/start", async (req, res) => {
  const { roomName, layout } = req.body as {
    roomName?: string;
    layout?: "speaker" | "grid";
  };

  console.log("=".repeat(80));
  console.log("🎬 /api/recordings/start called");
  console.log("=".repeat(80));
  console.log("Room:", roomName);
  console.log("Layout:", layout);

  if (!roomName) {
    console.error("❌ Missing roomName");
    return res.status(400).json({
      success: false,
      error: "roomName is required",
    });
  }

  const chosenLayout: "speaker" | "grid" = layout === "speaker" ? "speaker" : "grid";

  try {
    // Validate environment variables
    console.log("🔑 Checking environment variables...");
    
    const requiredEnvVars = [
      "LIVEKIT_URL",
      "LIVEKIT_API_KEY", 
      "LIVEKIT_API_SECRET",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET",
      "R2_ENDPOINT"
    ];

    const missingVars: string[] = [];
    for (const varName of requiredEnvVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }

    if (missingVars.length > 0) {
      const errorMsg = `Missing required environment variables: ${missingVars.join(", ")}`;
      console.error("❌", errorMsg);
      return res.status(500).json({
        success: false,
        error: errorMsg,
        details: { missingVars },
      });
    }

    // Initialize LiveKit client
    const LIVEKIT_URL = mustGetEnv("LIVEKIT_URL");
    const LIVEKIT_API_KEY = mustGetEnv("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = mustGetEnv("LIVEKIT_API_SECRET");

    console.log("✅ LiveKit credentials loaded");
    console.log("   URL:", LIVEKIT_URL);
    console.log("   API Key:", LIVEKIT_API_KEY.substring(0, 10) + "...");

    const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    console.log("✅ EgressClient initialized");

    // Prepare output configuration
    const filepath = `recordings/${roomName}/rec_${Date.now()}.mp4`;
    console.log("📁 File path:", filepath);

    const R2_ACCESS_KEY_ID = mustGetEnv("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = mustGetEnv("R2_SECRET_ACCESS_KEY");
    const R2_BUCKET = mustGetEnv("R2_BUCKET");
    const R2_ENDPOINT = mustGetEnv("R2_ENDPOINT");
    const R2_REGION = process.env.R2_REGION ?? "auto";

    console.log("✅ R2 credentials loaded");
    console.log("   Bucket:", R2_BUCKET);
    console.log("   Endpoint:", R2_ENDPOINT);

    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath,
      output: {
        case: "s3",
        value: new S3Upload({
          accessKey: R2_ACCESS_KEY_ID,
          secret: R2_SECRET_ACCESS_KEY,
          bucket: R2_BUCKET,
          endpoint: R2_ENDPOINT,
          region: R2_REGION,
          forcePathStyle: true,
        }),
      },
    });

    console.log("✅ S3Upload output configured");

    // Start egress
    console.log("🚀 Starting room composite egress...");
    const info: EgressInfo = await egressClient.startRoomCompositeEgress(roomName, {
      file: output,
    });

    console.log("✅ Egress API call completed");
    console.log("   Full response:", JSON.stringify(info, null, 2));

    // BULLETPROOF: Extract egressId with fallbacks
    // The response is EgressInfo which has egressId directly
    const egressId =
      info?.egressId ||
      (info as any)?.info?.egressId;

    if (!egressId) {
      console.error("❌ No egressId in response!");
      console.error("   Response structure:", Object.keys(info || {}));
      
      return res.status(500).json({
        success: false,
        error: "Egress started but no egressId returned by LiveKit.",
        details: {
          responseKeys: Object.keys(info || {}),
          fullResponse: process.env.NODE_ENV === "development" ? info : undefined,
        },
      });
    }

    console.log("✅ Recording ID extracted:", egressId);

    // Save to Firestore
    console.log("💾 Writing to Firestore...");
    await firestore.collection("recordings").doc(egressId).set(
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

    console.log("✅ Firestore document created");
    console.log("=".repeat(80));
    console.log("🎉 RECORDING STARTED SUCCESSFULLY");
    console.log("=".repeat(80));
    console.log("Recording ID:", egressId);
    console.log("Room:", roomName);
    console.log("Layout:", chosenLayout);
    console.log("=".repeat(80));

    // BULLETPROOF: Always return consistent JSON shape
      const responseData = {
        success: true,
        recording: {
          egressId,
          roomName,
          layout: chosenLayout,
          status: "RECORDING",
          startedAt: new Date().toISOString(),
        },
      };

      console.log("📤 Sending recording response:", responseData);

      return res.status(200).json(responseData);

  } catch (err: any) {
    console.error("=".repeat(80));
    console.error("❌ RECORDING START FAILED");
    console.error("=".repeat(80));
    console.error("Error name:", err?.name);
    console.error("Error message:", err?.message);
    console.error("Error stack:", err?.stack);
    console.error("=".repeat(80));
    
    // BULLETPROOF: Always return JSON, never crash without response
    return res.status(500).json({
      success: false,
      error: err?.message ?? "Failed to start recording",
      details: {
        name: err?.name,
        message: err?.message,
        stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
      },
    });
  }
});

// =============================================================================
// STOP RECORDING
// =============================================================================

router.post("/stop", async (req, res) => {
  const { recordingId } = req.body;
  
  console.log("=".repeat(80));
  console.log("⏹️ /api/recordings/stop called");
  console.log("=".repeat(80));
  console.log("Recording ID:", recordingId);
  
  if (!recordingId) {
    console.error("❌ Missing recordingId");
    return res.status(400).json({
      success: false,
      error: "recordingId is required",
    });
  }
  
  try {
    const LIVEKIT_URL = mustGetEnv("LIVEKIT_URL");
    const LIVEKIT_API_KEY = mustGetEnv("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = mustGetEnv("LIVEKIT_API_SECRET");

    console.log("🔑 LiveKit credentials loaded");

    const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    console.log("🛑 Stopping egress...");
    const response: EgressInfo = await egressClient.stopEgress(recordingId);

    console.log("✅ Egress stopped successfully");

    console.log("💾 Updating Firestore status...");
    await firestore.collection("recordings").doc(recordingId).set(
      {
        status: "STOP_REQUESTED",
        stoppedAt: new Date(),
      },
      { merge: true }
    );

    console.log("✅ Recording status updated to STOP_REQUESTED");
    console.log("=".repeat(80));

    // BULLETPROOF: Extract egressId from response
    const stoppedEgressId = response?.egressId || recordingId;

    // BULLETPROOF: Consistent response shape
    return res.status(200).json({
      success: true,
      data: {
        recordingId: stoppedEgressId,
        status: "STOP_REQUESTED",
        stoppedAt: new Date().toISOString(),
      },
    });
    
  } catch (err: any) {
    console.error("=".repeat(80));
    console.error("❌ RECORDING STOP FAILED");
    console.error("=".repeat(80));
    console.error("Error:", err?.message);
    console.error("Stack:", err?.stack);
    console.error("=".repeat(80));
    
    // BULLETPROOF: Always return JSON
    return res.status(500).json({
      success: false,
      error: "Failed to stop recording",
      details: err?.message || String(err),
    });
  }
});

export default router;