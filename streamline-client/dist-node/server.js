import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Look for .env in both dev and build modes
const envFromRoot = path.resolve(process.cwd(), '.env');
const envFromDist = path.resolve(__dirname, '../.env');
const envPath = fs.existsSync(envFromRoot) ? envFromRoot : envFromDist;
dotenv.config({ path: envPath });
console.log('ENV path:', envPath);
console.log('ENV loaded:', !!process.env.LIVEKIT_API_KEY, !!process.env.LIVEKIT_API_SECRET);
const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true }));
app.all('/v1/rooms/token', async (req, res) => {
    const q = req.method === 'GET' ? req.query : req.body;
    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        console.error('❌ Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET');
        return res.status(500).json({ error: 'missing_livekit_credentials' });
    }
    const roomName = String(q.roomName ?? 'default');
    const name = String(q.name ?? 'guest');
    const role = String(q.role ?? 'guest');
    try {
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: name });
        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: role === 'host',
            canSubscribe: true,
        });
        const token = await at.toJwt();
        res.json({ token });
    }
    catch (err) {
        console.error('Token error:', err);
        res.status(500).json({ error: 'failed_to_create_token' });
    }
});
const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`✅ Token server running on http://localhost:${PORT}`));
