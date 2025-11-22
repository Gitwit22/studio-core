// server/routes/multistream.ts
import express from "express";
import { egressClient } from "../livekitClient";
import { StreamOutput, StreamProtocol } from "livekit-server-sdk";

const router = express.Router();

router.post("/:roomName/start-multistream", async (req, res) => {
  const { roomName } = req.params;
  const { youtubeStreamKey, facebookStreamKey } = req.body as {
    youtubeStreamKey?: string;
    facebookStreamKey?: string;
  };

  if (!roomName) {
    return res.status(400).json({ error: "roomName is required" });
  }

  if (!youtubeStreamKey && !facebookStreamKey) {
    return res
      .status(400)
      .json({ error: "At least one stream key is required" });
  }

  try {
    const urls: string[] = [];
    if (youtubeStreamKey) {
      urls.push(`rtmp://a.rtmp.youtube.com/live2/${youtubeStreamKey}`);
    }
    if (facebookStreamKey) {
      urls.push(
        `rtmps://live-api-s.facebook.com:443/rtmp/${facebookStreamKey}`
      );
    }

    const streamOutput = new StreamOutput({
      protocol: StreamProtocol.RTMP,
      urls,
    });

    const info = await egressClient.startRoomCompositeEgress(
      roomName,
      { stream: streamOutput }, // EncodedOutputs
      { layout: "grid" }        // options (can tweak later)
    );

    return res.json({ egressId: info.egressId });
  } catch (err: any) {
    console.error("Error starting multistream", err);
    return res.status(500).json({
      error: "Failed to start multistream",
      details: err?.message,
    });
  }
});

router.post("/stop-multistream", async (req, res) => {
  const { egressId } = req.body as { egressId?: string };

  if (!egressId) {
    return res.status(400).json({ error: "egressId is required" });
  }

  try {
    await egressClient.stopEgress(egressId);
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
