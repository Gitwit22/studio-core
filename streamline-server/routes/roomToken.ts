import express from "express";
import { requireAuth } from "../middleware/requireAuth";

const router = express.Router();

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

router.post("/", async (req, res) => {
  try {
    const { roomName, identity } = req.body as {
      roomName?: string;
      identity?: string;
    };

    if (!roomName) {
      return res.status(400).json({ error: "roomName required" });
    }

    // Generate a safe guest identity if none provided
    const safeIdentity =
      (identity && String(identity).trim()) ||
      `guest_${Math.random().toString(36).slice(2, 10)}`;

    const apiKey = mustGetEnv("LIVEKIT_API_KEY");
    const apiSecret = mustGetEnv("LIVEKIT_API_SECRET");

    // ESM-safe dynamic import
    const { AccessToken } = await import("livekit-server-sdk");

    const token = new AccessToken(apiKey, apiSecret, {
      identity: safeIdentity,
      ttl: "1h",
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      roomAdmin: false, // 🔒 IMPORTANT: never trust client for admin
    });

    const jwt = await token.toJwt();

    return res.json({
      token: jwt,
      identity: safeIdentity,
    });
  } catch (err: any) {
    console.error("Room token error:", err?.message || err);
    return res.status(500).json({ error: "Failed to create token" });
  }
});

export default router;
