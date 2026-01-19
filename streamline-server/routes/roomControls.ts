import { Router } from "express";
import admin from "firebase-admin";
import { requireAuth } from "../middleware/requireAuth";
import { requireRoomAccessToken, type RoomAccessClaims } from "../middleware/roomAccessToken";

const router = Router();

type RoomControls = {
  canPublishAudio?: boolean;
  canPublishVideo?: boolean;
  canScreenShare?: boolean;
  tileVisible?: boolean;
  forcedMute?: boolean;
  forcedVideoOff?: boolean;
};

const DEFAULT_CONTROLS: Required<Pick<RoomControls, "canPublishAudio" | "tileVisible">> = {
  canPublishAudio: true,
  tileVisible: true,
};

function controlsDocRef(roomId: string) {
  return admin.firestore().collection("rooms").doc(roomId).collection("controls").doc("default");
}

function pickBoolean(v: any): boolean | undefined {
  if (typeof v === "boolean") return v;
  return undefined;
}

function isHostOrCohost(role?: string): boolean {
  const r = String(role || "").toLowerCase();
  return r === "host" || r === "cohost";
}

// Host/cohost updates controls for the whole room.
// PATCH /api/rooms/:roomId/controls?t=<roomAccessToken>
router.patch("/:roomId/controls", requireAuth as any, requireRoomAccessToken as any, async (req: any, res) => {
  const roomId = String(req.params.roomId || "").trim();
  if (!roomId) return res.status(400).json({ error: "roomId_required" });

  const access = (req as any).roomAccess as RoomAccessClaims | undefined;
  if (!access || !access.roomId) return res.status(401).json({ error: "room_token_required" });
  if (access.roomId !== roomId) return res.status(403).json({ error: "room_mismatch" });

  if (!isHostOrCohost(access.role)) {
    return res.status(403).json({ error: "insufficient_role" });
  }

  const uid = (req as any).user?.uid as string | undefined;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const body = (req.body || {}) as any;
  const patch: RoomControls = {
    canPublishAudio: pickBoolean(body.canPublishAudio),
    canPublishVideo: pickBoolean(body.canPublishVideo),
    canScreenShare: pickBoolean(body.canScreenShare),
    tileVisible: pickBoolean(body.tileVisible),
    forcedMute: pickBoolean(body.forcedMute),
    forcedVideoOff: pickBoolean(body.forcedVideoOff),
  };

  // Only accept known keys.
  const cleaned: RoomControls = {};
  (Object.keys(patch) as Array<keyof RoomControls>).forEach((k) => {
    const val = patch[k];
    if (typeof val === "boolean") (cleaned as any)[k] = val;
  });

  if (Object.keys(cleaned).length === 0) {
    return res.status(400).json({ error: "no_valid_fields" });
  }

  const ref = controlsDocRef(roomId);
  await ref.set(
    {
      ...cleaned,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByUid: uid,
    },
    { merge: true },
  );

  const snap = await ref.get();
  const data = snap.exists ? (snap.data() as any) : {};

  return res.json({
    ok: true,
    controls: {
      ...DEFAULT_CONTROLS,
      ...data,
    },
  });
});

// SSE stream of current controls.
// GET /api/rooms/:roomId/controls/stream?t=<roomAccessToken>
router.get("/:roomId/controls/stream", requireRoomAccessToken as any, async (req: any, res) => {
  const roomId = String(req.params.roomId || "").trim();
  if (!roomId) return res.status(400).json({ error: "roomId_required" });

  const access = (req as any).roomAccess as RoomAccessClaims | undefined;
  if (!access || !access.roomId) return res.status(401).json({ error: "room_token_required" });
  if (access.roomId !== roomId) return res.status(403).json({ error: "room_mismatch" });

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const write = (payload: any) => {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      // ignore
    }
  };

  const ref = controlsDocRef(roomId);

  // Send an initial payload.
  try {
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() as any) : {};
    write({
      ...DEFAULT_CONTROLS,
      ...data,
    });
  } catch {
    write({ ...DEFAULT_CONTROLS });
  }

  const unsubscribe = ref.onSnapshot(
    (snap) => {
      const data = snap.exists ? (snap.data() as any) : {};
      write({
        ...DEFAULT_CONTROLS,
        ...data,
      });
    },
    () => {
      // best-effort; keep connection alive with defaults
      write({ ...DEFAULT_CONTROLS });
    },
  );

  const heartbeat = setInterval(() => {
    res.write(`: keep-alive ${Date.now()}\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    try {
      unsubscribe();
    } catch {
      // ignore
    }
  });
});

export default router;
