import "dotenv/config";
import express from "express";
import cors from "cors";
import { RoomServiceClient, TrackSource, TrackType } from "livekit-server-sdk";
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
// Admin: mute/unmute a single participant's audio
app.post("/api/admin/mute", async (req, res) => {
  try {
    const { room, identity, muted } = req.body as {
      room?: string;
      identity?: string;
      muted?: boolean;
    };

    if (!room || !identity || typeof muted !== "boolean") {
      return res
        .status(400)
        .json({ error: "room, identity and muted are required" });
    }

    // Log for debugging
    console.log("ADMIN MUTE", { room, identity, muted });

    const participant = await roomService.getParticipant(room, identity);

    const audioTrack = participant.tracks?.find((t) => {
      const isAudioType = t.type === TrackType.AUDIO;
      const isMicSource = t.source === TrackSource.MICROPHONE;
      return isAudioType || isMicSource;
    });

    if (!audioTrack) {
      console.warn("No audio track found for", { room, identity });
      return res.status(404).json({ error: "no audio track found" });
    }

    await roomService.mutePublishedTrack(
      room,
      identity,
      audioTrack.sid,
      muted
    );

    return res.json({
      ok: true,
      muted,
      trackSid: audioTrack.sid,
      identity,
    });
  } catch (e: any) {
    console.error("mute error", e);
    const msg =
      typeof e?.message === "string"
        ? e.message
        : typeof e?.toString === "function"
        ? e.toString()
        : "mute_error";
    return res.status(500).json({ error: msg });
  }
});

// Admin: mute/unmute ALL participants' audio
// Admin: mute/unmute ALL participants' audio
app.post("/api/admin/mute-all", async (req, res) => {
  try {
    const { room, muted } = req.body as {
      room?: string;
      muted?: boolean;
    };

    if (!room || typeof muted !== "boolean") {
      return res
        .status(400)
        .json({ error: "room and muted are required" });
    }

    console.log("ADMIN MUTE-ALL", { room, muted });

    const participants = await roomService.listParticipants(room);

    const results: {
      identity: string;
      trackSid: string | null;
      changed: boolean;
    }[] = [];

    for (const p of participants) {
      const audioTrack = p.tracks?.find((t) => {
        const isAudioType = t.type === TrackType.AUDIO;
        const isMicSource = t.source === TrackSource.MICROPHONE;
        return isAudioType || isMicSource;
      });

      if (!audioTrack) {
        results.push({
          identity: p.identity,
          trackSid: null,
          changed: false,
        });
        continue;
      }

      await roomService.mutePublishedTrack(
        room,
        p.identity,
        audioTrack.sid,
        muted
      );

      results.push({
        identity: p.identity,
        trackSid: audioTrack.sid,
        changed: true,
      });
    }

    return res.json({ ok: true, muted, results });
  } catch (e: any) {
    console.error("mute-all error", e);
    const msg =
      typeof e?.message === "string"
        ? e.message
        : typeof e?.toString === "function"
        ? e.toString()
        : "mute_all_error";
    return res.status(500).json({ error: msg });
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
