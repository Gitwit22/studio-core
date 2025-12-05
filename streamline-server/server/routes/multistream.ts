// server/routes/multistream.ts
import express from "express";
import { egressClient } from "../livekitClient";
import { StreamOutput, StreamProtocol } from "livekit-server-sdk";

const router = express.Router();

// Keep track of active egress per room in memory
const activeEgressIds = new Map<string, string>();

router.post("/:roomName/start-multistream", async (req, res) => {
  const { roomName } = req.params;

  const {
    youtubeStreamKey,
    facebookStreamKey,
    twitchStreamKey,
  } = req.body as {
    youtubeStreamKey?: string;
    facebookStreamKey?: string;
    twitchStreamKey?: string;
  };

  if (!roomName) {
    return res.status(400).json({ error: "roomName is required" });
  }

  // Build RTMP URLs for each platform
  const urls: string[] = [];

  if (youtubeStreamKey) {
    // YouTube
    urls.push(`rtmp://a.rtmp.youtube.com/live2/${youtubeStreamKey}`);
  }

  if (facebookStreamKey) {
    // Facebook
    urls.push(
      `rtmps://live-api-s.facebook.com:443/rtmp/${facebookStreamKey}`
    );
  }

  if (twitchStreamKey) {
    // Twitch
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
      { layout: "grid" } // you can change layout if needed
    );

    // Remember egressId so we can stop it later
    if (info.egressId) {
      activeEgressIds.set(roomName, info.egressId);
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

  const egressId = activeEgressIds.get(roomName);

  if (!egressId) {
    return res.status(404).json({
      error: "No active multistream found for this room",
    });
  }

  try {
    await egressClient.stopEgress(egressId);
    activeEgressIds.delete(roomName);

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Error stopping multistream", err);
    return res.status(500).json({
      error: "Failed to stop multistream",
      details: err?.message,
    });
  }
});

export default router;
