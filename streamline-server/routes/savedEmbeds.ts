import { Router } from "express";
import admin from "firebase-admin";
import { requireAuth } from "../middleware/requireAuth";
import { firestore as db } from "../firebaseAdmin";
import { ensureRoomDoc, DEFAULT_ROOM_HLS_CONFIG, type RoomHlsConfig } from "../services/rooms";
import { sanitizeDisplayName } from "../lib/sanitizeDisplayName";
import { asOptionalBoolean, asOptionalEnum, asTrimmedString } from "../lib/inputValidation";

const router = Router();

type SavedEmbedDoc = {
  label: string;
  roomId: string;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  archived: boolean;
};

function viewerPath(roomId: string): string {
  return `/live/${roomId}`;
}

function savedEmbedsCol(uid: string) {
  return db.collection("users").doc(uid).collection("savedEmbeds");
}

function errorResponse(res: any, status: number, code: "invalid_input" | "not_found" | "server_error") {
  return res.status(status).json({ error: code });
}

function buildFriendlyLivekitRoomName(req: any, label: string, roomId: string): string {
  const rawDisplayName = (req as any).account?.rawUser?.displayName;
  const displayName = sanitizeDisplayName(rawDisplayName).trim();

  const combined = displayName ? `${displayName} – ${label}` : label;
  const sanitized = sanitizeDisplayName(combined).trim();
  return sanitized || roomId;
}

function parseHlsConfigOverrides(input: unknown):
  | { ok: true; value: Partial<RoomHlsConfig> }
  | { ok: false; error: "invalid_input" } {
  if (input === undefined || input === null) return { ok: true, value: {} };
  if (typeof input !== "object") return { ok: false, error: "invalid_input" };

  const obj = input as any;

  const enabledRes = asOptionalBoolean(obj.enabled);
  if (!enabledRes.ok) return { ok: false, error: "invalid_input" };

  const titleRes = asTrimmedString(obj.title, { required: false });
  if (!titleRes.ok) return { ok: false, error: "invalid_input" };

  const subtitleRes = asTrimmedString(obj.subtitle, { required: false });
  if (!subtitleRes.ok) return { ok: false, error: "invalid_input" };

  const logoUrlRes = asTrimmedString(obj.logoUrl, { required: false });
  if (!logoUrlRes.ok) return { ok: false, error: "invalid_input" };

  const offlineMessageRes = asTrimmedString(obj.offlineMessage, { required: false });
  if (!offlineMessageRes.ok) return { ok: false, error: "invalid_input" };

  const themeRes = asOptionalEnum(obj.theme, ["dark", "light"] as const);
  if (!themeRes.ok) return { ok: false, error: "invalid_input" };

  const overrides: Partial<RoomHlsConfig> = {};
  if (enabledRes.value !== undefined) overrides.enabled = enabledRes.value;
  if (titleRes.value !== undefined) overrides.title = titleRes.value;
  if (subtitleRes.value !== undefined) overrides.subtitle = subtitleRes.value;
  if (logoUrlRes.value !== undefined) overrides.logoUrl = logoUrlRes.value;
  if (offlineMessageRes.value !== undefined) overrides.offlineMessage = offlineMessageRes.value;
  if (themeRes.value !== undefined) overrides.theme = themeRes.value;

  return { ok: true, value: overrides };
}

// POST /api/saved-embeds
router.post("/", requireAuth as any, async (req: any, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const labelRes = asTrimmedString(req.body?.label, { required: true, maxLen: 60 });
  if (!labelRes.ok || !labelRes.value) {
    return errorResponse(res, 400, "invalid_input");
  }

  const hlsOverridesRes = parseHlsConfigOverrides(req.body?.hlsConfig);
  if (!hlsOverridesRes.ok) {
    return errorResponse(res, 400, "invalid_input");
  }

  const label = labelRes.value;

  // Create a NEW Firestore roomId (canonical), and create a friendly LiveKit room name.
  const roomId = db.collection("rooms").doc().id;
  const livekitRoomName = buildFriendlyLivekitRoomName(req, label, roomId);

  try {
    await ensureRoomDoc({
      roomId,
      ownerId: uid,
      livekitRoomName,
      roomType: "rtc",
      initialStatus: "idle",
    });

    // Initialize rooms/{roomId}.hlsConfig via merge update.
    // Do NOT touch rooms/{roomId}.hls runtime state.
    const nextHlsConfig: RoomHlsConfig = {
      ...DEFAULT_ROOM_HLS_CONFIG,
      ...hlsOverridesRes.value,
      updatedAt: new Date().toISOString(),
    };

    await db.collection("rooms").doc(roomId).set({ hlsConfig: nextHlsConfig }, { merge: true });

    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const embedRef = savedEmbedsCol(uid).doc();

    const doc: SavedEmbedDoc = {
      label,
      roomId,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
      archived: false,
    };

    await embedRef.set(doc as any, { merge: false });

    return res.status(201).json({
      success: true,
      embed: {
        embedId: embedRef.id,
        label,
        roomId,
        viewerPath: viewerPath(roomId),
      },
    });
  } catch (err) {
    console.error("POST /api/saved-embeds error", err);
    return errorResponse(res, 500, "server_error");
  }
});

// GET /api/saved-embeds
router.get("/", requireAuth as any, async (req: any, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  try {
    const snap = await savedEmbedsCol(uid)
      .where("archived", "==", false)
      .orderBy("updatedAt", "desc")
      .get();

    const embeds = snap.docs.map((d) => {
      const data = (d.data() || {}) as Partial<SavedEmbedDoc>;
      const roomId = String(data.roomId || "");
      const label = String(data.label || "");

      return {
        embedId: d.id,
        label,
        roomId,
        viewerPath: viewerPath(roomId),
      };
    });

    return res.json({ embeds });
  } catch (err) {
    console.error("GET /api/saved-embeds error", err);
    return errorResponse(res, 500, "server_error");
  }
});

// PUT /api/saved-embeds/:embedId
router.put("/:embedId", requireAuth as any, async (req: any, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const embedId = String(req.params.embedId || "").trim();
  if (!embedId) return errorResponse(res, 400, "invalid_input");

  const labelRes = asTrimmedString(req.body?.label, { required: false, maxLen: 60 });
  if (!labelRes.ok) return errorResponse(res, 400, "invalid_input");

  const archivedRes = asOptionalBoolean(req.body?.archived);
  if (!archivedRes.ok) return errorResponse(res, 400, "invalid_input");

  // Require at least one field.
  if (labelRes.value === undefined && archivedRes.value === undefined) {
    return errorResponse(res, 400, "invalid_input");
  }

  // If label is provided, it must not be empty after trimming.
  if (labelRes.value !== undefined && !labelRes.value) {
    return errorResponse(res, 400, "invalid_input");
  }

  const ref = savedEmbedsCol(uid).doc(embedId);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      return errorResponse(res, 404, "not_found");
    }

    const patch: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (labelRes.value !== undefined) patch.label = labelRes.value;
    if (archivedRes.value !== undefined) patch.archived = archivedRes.value;

    await ref.set(patch, { merge: true });

    const updated = await ref.get();
    const data = (updated.data() || {}) as Partial<SavedEmbedDoc>;

    const roomId = String(data.roomId || "");
    const label = String(data.label || "");

    return res.json({
      success: true,
      embed: {
        embedId,
        label,
        roomId,
        viewerPath: viewerPath(roomId),
      },
    });
  } catch (err) {
    console.error("PUT /api/saved-embeds/:embedId error", err);
    return errorResponse(res, 500, "server_error");
  }
});

export default router;
