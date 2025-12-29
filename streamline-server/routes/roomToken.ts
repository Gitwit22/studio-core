import express from "express";
import { requireAuth } from "../middleware/requireAuth";

const router = express.Router();

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

router.post("/", requireAuth, async (req, res) => {
  try {
    const { roomName, identity, isAdmin } = req.body;

    if (!roomName || !identity) {
      return res.status(400).json({ error: "roomName and identity required" });
    }

    // ✅ Lazy env reads
    const apiKey = mustGetEnv("LIVEKIT_API_KEY");
    const apiSecret = mustGetEnv("LIVEKIT_API_SECRET");

    // ✅ ESM-safe dynamic import
    const { AccessToken } = await import("livekit-server-sdk");

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: "1h",
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      roomAdmin: Boolean(isAdmin),
    });

    const jwt = await token.toJwt();

    return res.json({ token: jwt });
  } catch (err: any) {
    console.error("Room token error:", err?.message || err);
    return res.status(500).json({ error: "Failed to create token" });
  }
});

export default router;
