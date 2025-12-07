// server/routes/multistream.ts
import express from "express";
import { egressClient } from "../livekitClient";
import { StreamOutput, StreamProtocol } from "livekit-server-sdk";
import { firestore } from "../firebaseAdmin";
import { addUsageForUser, checkStorageLimit, updateStorageUsage } from "../usageHelper";
import { generateRecordingPath } from "../lib/storageClient";

const router = express.Router();

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
    userId, // Pass userId from frontend
    guestCount = 0,
  } = req.body as {
    youtubeStreamKey?: string;
    facebookStreamKey?: string;
    twitchStreamKey?: string;
    userId?: string;
    guestCount?: number;
  };

  if (!roomName) {
    return res.status(400).json({ error: "roomName is required" });
  }

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  // Build RTMP URLs for each platform
  const urls: string[] = [];

  if (youtubeStreamKey) {
    urls.push(`rtmp://a.rtmp.youtube.com/live2/${youtubeStreamKey}`);
  }

  if (facebookStreamKey) {
    urls.push(
      `rtmps://live-api-s.facebook.com:443/rtmp/${facebookStreamKey}`
    );
  }

  if (twitchStreamKey) {
    urls.push(`rtmp://live.twitch.tv/app/${twitchStreamKey}`);
  }

  if (urls.length === 0) {
    return res
      .status(400)
      .json({ error: "At least one stream key (YouTube, Facebook, Twitch) is required" });
  }

  try {
    const streamOutput = new StreamOutput({
      protocol: StreamProtocol.RTMP,
      urls,
    });

    // Start Room Composite egress and stream to all URLs
    const info = await egressClient.startRoomCompositeEgress(
      roomName,
      { stream: streamOutput },
      { layout: "grid" }
    );

    // Track the active stream with metadata
    if (info.egressId) {
      activeStreams.set(roomName, {
        egressId: info.egressId,
        userId,
        roomName,
        startedAt: new Date(),
        guestCount,
      });

      // Also store in Firestore for persistence (optional, for webhooks later)
      await firestore.collection("activeStreams").doc(roomName).set(
        {
          egressId: info.egressId,
          userId,
          roomName,
          startedAt: new Date(),
          guestCount,
        },
        { merge: true }
      );
    }

    return res.json({
      success: true,
      egressId: info.egressId,
      urls,
    });
  } catch (err: any) {
    console.error("Error starting multistream", err);
    return res.status(500).json({
      error: "Failed to start multistream",
      details: err?.message,
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
    const durationMinutes = Math.ceil(durationMs / 60000); // Round up to nearest minute

    // Add usage for this stream
    const usageResult = await addUsageForUser(activeStream.userId, durationMinutes, {
      guestCount: activeStream.guestCount,
      description: `Stream in room ${activeStream.roomName}`,
    });

    // ✅ PROMPT #2: Create recording document after stream ends
    const timestamp = Date.now();
    const recordingPath = generateRecordingPath(activeStream.userId, activeStream.roomName, timestamp);

    // Create recording doc in Firestore
    const recordingRef = await firestore.collection("recordings").add({
      userId: activeStream.userId,
      roomId: activeStream.roomName,
      title: `Stream - ${new Date(activeStream.startedAt).toLocaleString()}`,
      createdAt: activeStream.startedAt,
      durationMinutes,
      storagePath: recordingPath,
      status: "processing", // Will be "ready" once video is uploaded to R2
      planId: "free", // Will be fetched from user doc
      guestCount: activeStream.guestCount || 0,
      editConfig: null,
      renderedPath: null,
      uploadedToUrls: {},
      updatedAt: now,
    });

    console.log(`✅ Created recording doc: ${recordingRef.id}`);

    // Clean up tracking
    activeStreams.delete(activeStream.roomName);
    await firestore.collection("activeStreams").doc(activeStream.roomName).delete();

    return res.json({
      success: true,
      durationMinutes,
      recordingId: recordingRef.id,
      recordingPath,
      usageUpdated: usageResult,
    });
  } catch (err: any) {
    console.error("Error stopping multistream", err);
    return res.status(500).json({
      error: "Failed to stop multistream",
      details: err?.message,
    });
  }
});

export default router;
