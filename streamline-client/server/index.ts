import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';

const app = express();
app.use(cors());

app.get('/v1/rooms/token', async (req, res) => {
  try {
    const { roomName = 'default', name = 'Guest', role = 'participant' } = req.query as Record<string, string>;

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'LIVEKIT_API_KEY/SECRET missing on server' });
    }

    const at = new AccessToken(apiKey, apiSecret, { identity: name });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      ingressAdmin: role === 'host'
    });

    res.json({ token: await at.toJwt() });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'token_error' });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
