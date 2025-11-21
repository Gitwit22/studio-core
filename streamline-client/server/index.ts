import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';
import { RoomServiceClient } from 'livekit-server-sdk';

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

// -------------------------------
// Admin Controls (Host/Mod Only)
// -------------------------------
const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

// Mute/unmute a participant
app.post('/api/admin/mute', async (req, res) => {
  try {
    const { room, identity, muted } = req.body;
    await roomService.mutePublishedTrack(room, identity, undefined, muted);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('mute error', e);
    res.status(500).json({ error: e.message || 'mute_error' });
  }
});

// Remove/kick a participant
app.post('/api/admin/remove', async (req, res) => {
  try {
    const { room, identity } = req.body;
    await roomService.removeParticipant(room, identity);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('remove error', e);
    res.status(500).json({ error: e.message || 'remove_error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`✅ API listening on http://localhost:${PORT}`)
);
