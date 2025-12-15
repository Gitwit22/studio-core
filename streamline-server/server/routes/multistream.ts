// server/routes/multistream.ts
import express from "express";
import { 
  EgressClient, 
  StreamOutput, 
  StreamProtocol,
  EncodingOptionsPreset
} from "livekit-server-sdk";
import { firestore } from "../firebaseAdmin";
import { addUsageForUser } from "../usageHelper";
import { generateRecordingPath, getSignedDownloadUrl } from "../lib/storageClient";

const router = express.Router();

// Initialize the egress client
const egressClient = new EgressClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

// Keep track of active egress + stream metadata per room
interface ActiveStream {
  egressId: string;
  userId: string;
  roomName: string;
  startedAt: Date;
  guestCount?: number;
}

const activeStreams = new Map<string, ActiveStream>();

router.post("/:roomName/start-multistream", async (req, res) => {
  const { roomName } = req.params;

  const {
    youtubeStreamKey,
    facebookStreamKey,
    twitchStreamKey,
    userId,
    guestCount = 0,
  } = req.body as {
    youtubeStreamKey?: string;
    facebookStreamKey?: string;
    twitchStreamKey?: string;
    userId?: string;
    guestCount?: number;
  };

  console.log('🎬 Multistream request:', { 
    roomName, 
    userId, 
    hasYoutube: !!youtubeStreamKey, 
    hasFacebook: !!facebookStreamKey, 
    hasTwitch: !!twitchStreamKey 
  });

  if (!roomName) {
    return res.status(400).json({ error: "roomName is required" });
  }

  // For MVP, userId is optional - use fallback if not provided
  const finalUserId = userId || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Build RTMP URLs for each platform
  const urls: string[] = [];

  if (youtubeStreamKey) {
    urls.push(`rtmp://a.rtmp.youtube.com/live2/${youtubeStreamKey}`);
    console.log("   ✅ YouTube URL added");
  }

  if (facebookStreamKey) {
    // Facebook requires RTMPS (secure) on port 443
    // Clean up the key in case it has extra prefixes
    let cleanKey = facebookStreamKey;
    if (facebookStreamKey.includes("rtmps://") || facebookStreamKey.includes("rtmp://")) {
      const parts = facebookStreamKey.split("/");
      cleanKey = parts[parts.length - 1];
    }
    const fbUrl = `rtmps://live-api-s.facebook.com:443/rtmp/${cleanKey}`;
    console.log('   ✅ Facebook URL added');
    urls.push(fbUrl);
  }

  if (twitchStreamKey) {
    urls.push(`rtmp://live.twitch.tv/app/${twitchStreamKey}`);
    console.log("   ✅ Twitch URL added");
  }

  if (urls.length === 0) {
    return res
      .status(400)
      .json({ error: "At least one stream key (YouTube, Facebook, Twitch) is required" });
  }

  try {
    console.log(`📡 Starting multistream for room: ${roomName}`);
    console.log(`   Streaming to ${urls.length} platform(s)`);

    // Create RTMP stream output
    const streamOutput = new StreamOutput({
      protocol: StreamProtocol.RTMP,
      urls,
    });

    // Start Room Composite egress with preset encoding (compatible with all platforms)
    const response = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        stream: streamOutput,
      },
      {
        layout: "grid",
        // Use H264_1080P_30 preset - compatible with YouTube, Facebook, and Twitch
        encodingOptions: EncodingOptionsPreset.H264_1080P_30,
      }
    );

    console.log('✅ Egress started:', response.egressId, 'Status:', response.status);

    if (response.egressId) {
      // Track the active stream with metadata
      activeStreams.set(roomName, {
        egressId: response.egressId,
        userId: finalUserId,
        roomName,
        startedAt: new Date(),
        guestCount,
      });

      // Also store in Firestore for persistence
      await firestore.collection("activeStreams").doc(roomName).set(
        {
          egressId: response.egressId,
          userId: finalUserId,
          roomName,
          startedAt: new Date(),
          guestCount,
        },
        { merge: true }
      );

      return res.json({
        success: true,
        egressId: response.egressId,
        status: "started",
        platforms: urls.length,
      });
    } else {
      return res.status(500).json({ error: "Failed to start egress - no ID returned" });
    }
  } catch (err: any) {
    console.error("❌ Error starting multistream:", {
      error: err?.message,
      stack: err?.stack,
      roomName,
      urlCount: urls.length,
    });
    
    return res.status(500).json({
      error: "Failed to start multistream",
      details: err?.message,
      roomName,
      timestamp: new Date().toISOString()
    });
  }
});

router.post("/:roomName/stop-multistream", async (req, res) => {
  const { roomName } = req.params;

  if (!roomName) {
    return res.status(400).json({ error: "roomName is required" });
  }

  const activeStream = activeStreams.get(roomName);

  if (!activeStream) {
    return res.status(404).json({
      error: "No active multistream found for this room",
    });
  }

  try {
    // Stop the egress
    await egressClient.stopEgress(activeStream.egressId);
    
    // Calculate stream duration
    const now = new Date();
    const durationMs = now.getTime() - activeStream.startedAt.getTime();
    const durationSeconds = Math.floor(durationMs / 1000);
    const durationMinutes = Math.ceil(durationMs / 60000);

    // Add usage for this stream
    let usageResult = null;
    try {
      usageResult = await addUsageForUser(activeStream.userId, durationMinutes, {
        guestCount: activeStream.guestCount,
        description: `Stream in room ${activeStream.roomName}`,
      });
    } catch (usageErr) {
      console.warn("Failed to update usage:", usageErr);
    }

    // Generate recording path and get the video URL
    let videoUrl = null;
    let recordingPath = null;
    try {
      const timestamp = Date.now();
      recordingPath = generateRecordingPath(activeStream.userId, activeStream.roomName, timestamp);
      videoUrl = await getSignedDownloadUrl(recordingPath);
      console.log("🎬 Recording path:", recordingPath);
    } catch (storageErr) {
      console.warn("Failed to generate recording URL:", storageErr);
    }

    // Create recording document in Firestore
    let recordingId = null;
    try {
      const recordingRef = await firestore.collection("recordings").add({
        userId: activeStream.userId,
        roomName: activeStream.roomName,
        title: `Stream - ${new Date(activeStream.startedAt).toLocaleString()}`,
        status: "ready",
        duration: durationSeconds,
        durationMinutes,
        viewerCount: activeStream.guestCount || 0,
        peakViewers: activeStream.guestCount || 0,
        videoUrl,
        thumbnailUrl: null,
        storagePath: recordingPath,
        progress: 100,
        createdAt: activeStream.startedAt,
        updatedAt: now,
      });
      recordingId = recordingRef.id;
      console.log(`✅ Created recording doc: ${recordingRef.id}`);
    } catch (firestoreErr) {
      console.warn("Failed to create recording doc:", firestoreErr);
    }

    // Clean up tracking
    activeStreams.delete(roomName);
    try {
      await firestore.collection("activeStreams").doc(roomName).delete();
    } catch (cleanupErr) {
      console.warn("Failed to cleanup activeStreams doc:", cleanupErr);
    }

    return res.json({
      success: true,
      egressId: activeStream.egressId,
      durationSeconds,
      durationMinutes,
      recordingId,
      videoUrl,
      usageUpdated: usageResult,
    });
  } catch (err: any) {
    console.error("Error stopping multistream:", err);
    return res.status(500).json({
      error: "Failed to stop multistream",
      details: err?.message,
    });
  }
});

// Legacy route for stopping via POST body with egressId
router.post("/stop-multistream", async (req, res) => {
  const { egressId } = req.body;

  if (!egressId) {
    return res.status(400).json({ error: "egressId is required" });
  }

  try {
    console.log(`🛑 Stopping egress: ${egressId}`);
    
    const response = await egressClient.stopEgress(egressId);
    
    // Remove from tracking map
    for (const [roomName, stream] of activeStreams.entries()) {
      if (stream.egressId === egressId) {
        activeStreams.delete(roomName);
        try {
          await firestore.collection("activeStreams").doc(roomName).delete();
        } catch (e) {
          // Ignore cleanup errors
        }
        break;
      }
    }

    console.log(`✅ Stopped egress: ${egressId}`);
    return res.json({ 
      success: true,
      egressId: response.egressId,
      status: "stopped" 
    });
  } catch (error: any) {
    console.error("Error stopping multistream:", error?.message);
    return res.status(500).json({ error: "Failed to stop multistream" });
  }
});

// Get status of all active streams
router.get("/status", (_req, res) => {
  const streams = Array.from(activeStreams.entries()).map(([roomName, stream]) => ({
    roomName,
    egressId: stream.egressId,
    userId: stream.userId,
    startedAt: stream.startedAt,
    durationMinutes: Math.floor((Date.now() - stream.startedAt.getTime()) / 60000),
  }));

  res.json({ activeStreams: streams });
});

export default router;