import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pino from 'pino';
import pinoHttp from 'pino-http';
import healthRouter from './routes/health';
import tokensRouter from './routes/tokens';
const app = express();

// Logging + middleware
app.use(pinoHttp({ logger: pino() }));
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));

// Routes
app.get('/', (_req, res) => res.json({ name: 'streamline-api', status: 'ok' }));
app.use('/health', healthRouter);
app.use('/v1/rooms', tokensRouter);

// Start server
const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => console.log(`✅ API listening on :${port}`));
