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
  // Access scopes / capabilities (used for in-room UI gating; set via presets).
  canMuteGuests?: boolean;
  canInviteLinks?: boolean;
  canManageDestinations?: boolean;
  canStartStopStream?: boolean;
  canStartStopRecording?: boolean;
  // Optional future scopes.
  canViewAnalytics?: boolean;
  canChangeLayoutScene?: boolean;
  forcedMute?: boolean;
  forcedVideoOff?: boolean;
  role?: string;
};

const DEFAULT_CONTROLS: Required<Pick<RoomControls, "canPublishAudio" | "tileVisible">> = {
  canPublishAudio: true,
  tileVisible: true,
};

function controlsDocRef(roomId: string, docId: string) {
  return admin.firestore().collection("rooms").doc(roomId).collection("controls").doc(docId);
}

function normalizeControlsDocId(raw: any): string {
  const id = String(raw || "").trim();
  if (!id) return "default";
  // Firestore doc IDs cannot contain '/' and we keep this intentionally strict.
  if (id.includes("/")) return "default";
  if (id.length > 128) return id.slice(0, 128);
  return id;
}

type PresetId = "moderator" | "cohost" | "participant";

const SYSTEM_ROLE_PRESETS: Record<
  PresetId,
  Required<
    Pick<
      RoomControls,
      | "role"
      | "canPublishAudio"
      | "canPublishVideo"
      | "canScreenShare"
      | "tileVisible"
      | "canMuteGuests"
      | "canInviteLinks"
      | "canManageDestinations"
      | "canStartStopStream"
      | "canStartStopRecording"
    >
  >
> = {
  participant: {
    role: "participant",
    canPublishAudio: true,
    canPublishVideo: true,
    canScreenShare: false,
    tileVisible: true,
    canMuteGuests: false,
    canInviteLinks: false,
    canManageDestinations: false,
    canStartStopStream: false,
    canStartStopRecording: false,
  },
  moderator: {
    role: "moderator",
    canPublishAudio: true,
    canPublishVideo: true,
    canScreenShare: false,
    tileVisible: true,
    canMuteGuests: true,
    canInviteLinks: true,
    canManageDestinations: false,
    canStartStopStream: false,
    canStartStopRecording: false,
  },
  cohost: {
    role: "cohost",
    canPublishAudio: true,
    canPublishVideo: true,
    canScreenShare: true,
    tileVisible: true,
    canMuteGuests: true,
    canInviteLinks: true,
    canManageDestinations: true,
    canStartStopStream: true,
    canStartStopRecording: true,
  },
};

function presetDocRef(uid: string, presetId: PresetId) {
  // "Account" is currently modeled as the authenticated user document.
  return admin.firestore().collection("users").doc(uid).collection("rolePresets").doc(presetId);
}

function parsePresetId(raw: any): PresetId | null {
  const v = String(raw || "").toLowerCase();
  if (v === "moderator" || v === "cohost" || v === "participant") return v;
  return null;
}

async function loadPresetForUser(uid: string, presetId: PresetId): Promise<RoomControls> {
  try {
    const snap = await presetDocRef(uid, presetId).get();
    if (snap.exists) {
      const data = (snap.data() || {}) as any;
      const merged: RoomControls = {
        role: typeof data.role === "string" ? data.role : presetId,
        canPublishAudio: pickBoolean(data.canPublishAudio),
        canPublishVideo: pickBoolean(data.canPublishVideo),
        canScreenShare: pickBoolean(data.canScreenShare),
        tileVisible: pickBoolean(data.tileVisible),
        canMuteGuests: pickBoolean(data.canMuteGuests),
        canInviteLinks: pickBoolean(data.canInviteLinks),
        canManageDestinations: pickBoolean(data.canManageDestinations),
        canStartStopStream: pickBoolean(data.canStartStopStream),
        canStartStopRecording: pickBoolean(data.canStartStopRecording),
        canViewAnalytics: pickBoolean(data.canViewAnalytics),
        canChangeLayoutScene: pickBoolean(data.canChangeLayoutScene),
      };

      // Hard guarantees for moderator.
      if (presetId === "moderator") {
        merged.canViewAnalytics = false;
        merged.canChangeLayoutScene = false;
      }

      return merged;
    }
  } catch {
    // ignore and fall back to system preset
  }

  return { ...SYSTEM_ROLE_PRESETS[presetId] };
}

function mergeControls(defaultDoc: any, identityDoc: any) {
  return {
    ...DEFAULT_CONTROLS,
    ...(defaultDoc || {}),
    ...(identityDoc || {}),
  };
}

async function readControlsMerged(roomId: string, identityDocId: string) {
  const defaultRef = controlsDocRef(roomId, "default");
  const identityRef = controlsDocRef(roomId, identityDocId);
  const [dSnap, iSnap] = await Promise.all([defaultRef.get(), identityRef.get()]);
  const d = dSnap.exists ? (dSnap.data() as any) : {};
  const i = iSnap.exists ? (iSnap.data() as any) : {};
  return mergeControls(d, i);
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
// PATCH /api/rooms/:roomId/controls
// Auth: Firebase session cookie + Authorization: Bearer <roomAccessToken>
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
    canMuteGuests: pickBoolean(body.canMuteGuests),
    canInviteLinks: pickBoolean(body.canInviteLinks),
    canManageDestinations: pickBoolean(body.canManageDestinations),
    canStartStopStream: pickBoolean(body.canStartStopStream),
    canStartStopRecording: pickBoolean(body.canStartStopRecording),
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

  const ref = controlsDocRef(roomId, "default");
  await ref.set(
    {
      ...cleaned,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByUid: uid,
    },
    { merge: true },
  );

  const identityDocId = normalizeControlsDocId((req.query as any)?.identity);
  const merged = await readControlsMerged(roomId, identityDocId);
  return res.json({ ok: true, controls: merged });
});

// Host/cohost updates controls for a specific participant identity (override doc).
// PATCH /api/rooms/:roomId/controls/:identity
// Auth: Firebase session cookie + Authorization: Bearer <roomAccessToken>
router.patch("/:roomId/controls/:identity", requireAuth as any, requireRoomAccessToken as any, async (req: any, res) => {
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

  const identityDocId = normalizeControlsDocId(req.params.identity);
  const body = (req.body || {}) as any;

  // If a role is provided, treat this as a role change and
  // apply the corresponding preset defaults, resetting overrides.
  const rolePresetId = parsePresetId(body.role);
  if (rolePresetId) {
    const preset = await loadPresetForUser(uid, rolePresetId);
    const cleanedFromPreset: RoomControls = {
      role: rolePresetId,
      canPublishAudio: pickBoolean(preset.canPublishAudio),
      canPublishVideo: pickBoolean(preset.canPublishVideo),
      canScreenShare: pickBoolean(preset.canScreenShare),
      tileVisible: pickBoolean(preset.tileVisible),
      canMuteGuests: pickBoolean(preset.canMuteGuests),
      canInviteLinks: pickBoolean(preset.canInviteLinks),
      canManageDestinations: pickBoolean(preset.canManageDestinations),
      canStartStopStream: pickBoolean(preset.canStartStopStream),
      canStartStopRecording: pickBoolean(preset.canStartStopRecording),
      canViewAnalytics: pickBoolean(preset.canViewAnalytics),
      canChangeLayoutScene: pickBoolean(preset.canChangeLayoutScene),
    };

    // Hard guarantees for moderator.
    if (rolePresetId === "moderator") {
      cleanedFromPreset.canViewAnalytics = false;
      cleanedFromPreset.canChangeLayoutScene = false;
    }

    const ref = controlsDocRef(roomId, identityDocId);
    await ref.set(
      {
        ...cleanedFromPreset,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUid: uid,
        appliedPresetId: rolePresetId,
      },
      { merge: true },
    );

    const merged = await readControlsMerged(roomId, identityDocId);
    return res.json({ ok: true, controls: merged });
  }

  // Otherwise, behave as a classic partial controls patch.
  const patch: RoomControls = {
    canPublishAudio: pickBoolean(body.canPublishAudio),
    canPublishVideo: pickBoolean(body.canPublishVideo),
    canScreenShare: pickBoolean(body.canScreenShare),
    tileVisible: pickBoolean(body.tileVisible),
    canMuteGuests: pickBoolean(body.canMuteGuests),
    canInviteLinks: pickBoolean(body.canInviteLinks),
    canManageDestinations: pickBoolean(body.canManageDestinations),
    canStartStopStream: pickBoolean(body.canStartStopStream),
    canStartStopRecording: pickBoolean(body.canStartStopRecording),
    forcedMute: pickBoolean(body.forcedMute),
    forcedVideoOff: pickBoolean(body.forcedVideoOff),
  };

  const cleaned: RoomControls = {};
  (Object.keys(patch) as Array<keyof RoomControls>).forEach((k) => {
    const val = patch[k];
    if (typeof val === "boolean") (cleaned as any)[k] = val;
  });

  if (Object.keys(cleaned).length === 0) {
    return res.status(400).json({ error: "no_valid_fields" });
  }

  const ref = controlsDocRef(roomId, identityDocId);
  await ref.set(
    {
      ...cleaned,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByUid: uid,
    },
    { merge: true },
  );

  const merged = await readControlsMerged(roomId, identityDocId);
  return res.json({ ok: true, controls: merged });
});

// Apply a saved preset to a participant identity.
// POST /api/rooms/:roomId/controls/:identity/apply-preset
// Auth: Firebase session cookie + Authorization: Bearer <roomAccessToken>
router.post("/:roomId/controls/:identity/apply-preset", requireAuth as any, requireRoomAccessToken as any, async (req: any, res) => {
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

  const presetId = parsePresetId((req.body as any)?.presetId);
  if (!presetId) return res.status(400).json({ error: "presetId_required" });

  const identityDocId = normalizeControlsDocId(req.params.identity);
  const preset = await loadPresetForUser(uid, presetId);
  const cleaned: RoomControls = {
    role: presetId,
    canPublishAudio: pickBoolean(preset.canPublishAudio),
    canPublishVideo: pickBoolean(preset.canPublishVideo),
    canScreenShare: pickBoolean(preset.canScreenShare),
    tileVisible: pickBoolean(preset.tileVisible),
    canMuteGuests: pickBoolean(preset.canMuteGuests),
    canInviteLinks: pickBoolean(preset.canInviteLinks),
    canManageDestinations: pickBoolean(preset.canManageDestinations),
    canStartStopStream: pickBoolean(preset.canStartStopStream),
    canStartStopRecording: pickBoolean(preset.canStartStopRecording),
    canViewAnalytics: pickBoolean(preset.canViewAnalytics),
    canChangeLayoutScene: pickBoolean(preset.canChangeLayoutScene),
  };

  // Hard guarantees for moderator.
  if (presetId === "moderator") {
    cleaned.canViewAnalytics = false;
    cleaned.canChangeLayoutScene = false;
  }

  const ref = controlsDocRef(roomId, identityDocId);
  await ref.set(
    {
      ...cleaned,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByUid: uid,
      appliedPresetId: presetId,
    },
    { merge: true },
  );

  const merged = await readControlsMerged(roomId, identityDocId);
  return res.json({ ok: true, controls: merged });
});

// SSE stream of current controls.
// GET /api/rooms/:roomId/controls/stream
// Auth: Authorization: Bearer <roomAccessToken>
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

  const identityDocId = normalizeControlsDocId((req.query as any)?.identity);
  const defaultRef = controlsDocRef(roomId, "default");
  const identityRef = controlsDocRef(roomId, identityDocId);

  let lastDefault: any = {};
  let lastIdentity: any = {};
  const emit = () => write(mergeControls(lastDefault, lastIdentity));

  // Send an initial payload.
  try {
    const merged = await readControlsMerged(roomId, identityDocId);
    write(merged);
  } catch {
    write({ ...DEFAULT_CONTROLS });
  }

  const unsubDefault = defaultRef.onSnapshot(
    (snap) => {
      lastDefault = snap.exists ? (snap.data() as any) : {};
      emit();
    },
    () => {
      lastDefault = {};
      emit();
    },
  );

  const unsubIdentity = identityRef.onSnapshot(
    (snap) => {
      lastIdentity = snap.exists ? (snap.data() as any) : {};
      emit();
    },
    () => {
      lastIdentity = {};
      emit();
    },
  );

  const heartbeat = setInterval(() => {
    res.write(`: keep-alive ${Date.now()}\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    try {
      unsubDefault();
      unsubIdentity();
    } catch {
      // ignore
    }
  });
});

export default router;
