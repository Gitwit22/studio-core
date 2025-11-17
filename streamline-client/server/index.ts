import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_, res) => res.send('API up'));

app.get('/api/token', async (req, res) => {
  try {
    const room = (req.query.room as string) || 'default';
    const identity = (req.query.identity as string) || 'Guest';
    const role = (req.query.role as string) || 'participant';

    const key = process.env.LIVEKIT_API_KEY!;
    const secret = process.env.LIVEKIT_API_SECRET!;
    const url = process.env.LIVEKIT_URL!;

    if (!key || !secret || !url)
      return res.status(500).json({ error: 'LIVEKIT env missing' });

    const at = new AccessToken(key, secret, { identity });
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      ingressAdmin: role === 'host',
    });

    res.json({ token: await at.toJwt(), url });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'token_error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`✅ API listening on http://localhost:${PORT}`)
);
