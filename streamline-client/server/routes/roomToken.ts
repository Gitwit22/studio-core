import express from "express";
import { AccessToken } from "livekit-server-sdk";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { roomName, identity } = req.body as {
      roomName?: string;
      identity?: string;
    };

    const room = roomName || "default";
    const userIdentity = identity || "Guest";

    const key = process.env.LIVEKIT_API_KEY!;
    const secret = process.env.LIVEKIT_API_SECRET!;
    const url = process.env.LIVEKIT_URL!; // LiveKit server URL

    if (!key || !secret || !url) {
      console.error("roomToken error: LIVEKIT env missing");
      return res.status(500).json({ error: "LIVEKIT env missing" });
    }

    const at = new AccessToken(key, secret, { identity: userIdentity });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      ingressAdmin: true, // treat caller as host for now
    });

    const token = await at.toJwt();

    // This shape matches what Room.tsx expects
    res.json({ token, serverUrl: url });
  } catch (e: any) {
    console.error("roomToken error:", e);
    res.status(500).json({ error: e.message || "roomToken_error" });
  }
});

export default router;
