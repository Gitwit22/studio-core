import { Router } from "express";
import { z } from "zod";
import { AccessToken } from "livekit-server-sdk";

const router = Router();

const TokenReq = z.object({
  roomId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["host", "guest"]),
});

router.post("/token", async (req, res) => {
  const parsed = TokenReq.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { roomId, userId, role } = parsed.data;
  const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL } = process.env;

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_WS_URL) {
    return res.status(500).json({ error: "LiveKit environment vars not set" });
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: userId,
    ttl: 60 * 60 * 2,
    metadata: JSON.stringify({ role }),
  });

  at.addGrant({
    room: roomId,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  res.json({ token, wsUrl: LIVEKIT_WS_URL });
});

export default router;
