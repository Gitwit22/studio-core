import "dotenv/config";
import express from "express";
import cors from "cors";
import { RoomServiceClient } from "livekit-server-sdk";
import multistreamRoutes from "./routes/multistream";
import roomTokenRoute from "./routes/roomToken";

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (_req, res) => res.send("API up"));

// Token route used by the frontend
app.use("/api/roomToken", roomTokenRoute);

// Multistream routes (YouTube/FB)
app.use("/api/rooms", multistreamRoutes);

// -------------------------------
// Admin Controls (Host/Mod Only)
// -------------------------------
const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

// Mute/unmute a participant
app.post("/api/admin/mute", async (req, res) => {
  try {
    const { room, identity, muted } = req.body;
    await roomService.mutePublishedTrack(room, identity, undefined, muted);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("mute error", e);
    res.status(500).json({ error: e.message || "mute_error" });
  }
});

// Remove/kick a participant
app.post("/api/admin/remove", async (req, res) => {
  try {
    const { room, identity } = req.body;
    await roomService.removeParticipant(room, identity);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("remove error", e);
    res.status(500).json({ error: e.message || "remove_error" });
  }
});

const PORT = process.env.PORT || 5137; // use whatever you were using when it worked
app.listen(PORT, () => {
  console.log(`✅ API listening on http://localhost:${PORT}`);
});
