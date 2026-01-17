import { Router } from "express";
import { firestore as db } from "../firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { assertRoomPerm, RoomPermissionError } from "../lib/rolePermissions";

const router = Router();

function normalizeId(raw: string | undefined): string {
  return String(raw || "").trim();
}

function looksLikeRoomName(value: string): boolean {
  return /[ \u2013#]/.test(value);
}

// GET /api/rooms/:roomId/active-embed -> { roomId, activeEmbedId, activeEmbedRoomId }
router.get("/:roomId/active-embed", requireAuth as any, async (req: any, res) => {
  const roomId = normalizeId(req.params.roomId);
  if (!roomId) {
    return res.status(400).json({ error: "invalid_room_id" });
  }

  try {
    const ctx = await assertRoomPerm(req as any, roomId, "canStream");

    return res.json({
      roomId: ctx.roomId,
      activeEmbedId: typeof (ctx.room as any).activeEmbedId === "string" ? (ctx.room as any).activeEmbedId : null,
      activeEmbedRoomId:
        typeof (ctx.room as any).activeEmbedRoomId === "string" ? (ctx.room as any).activeEmbedRoomId : null,
    });
  } catch (err: any) {
    if (err instanceof RoomPermissionError) {
      return res.status(err.status).json({ error: err.code });
    }
    console.error("GET /api/rooms/:roomId/active-embed error", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// PUT /api/rooms/:roomId/active-embed { embedId, embedRoomId }
router.put("/:roomId/active-embed", requireAuth as any, async (req: any, res) => {
  const roomId = normalizeId(req.params.roomId);
  if (!roomId) {
    return res.status(400).json({ error: "invalid_room_id" });
  }

  const uid = (req as any).user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const embedId = normalizeId(req.body?.embedId);
  const embedRoomId = normalizeId(req.body?.embedRoomId);

  if (!embedId || !embedRoomId) {
    return res.status(400).json({ error: "invalid_input" });
  }

  if (looksLikeRoomName(embedRoomId)) {
    return res.status(400).json({ error: "invalid_input", details: "embedRoomId must be a canonical roomId" });
  }

  try {
    const ctx = await assertRoomPerm(req as any, roomId, "canStream");

    const embedRef = db.collection("users").doc(uid).collection("savedEmbeds").doc(embedId);
    const embedSnap = await embedRef.get();
    if (!embedSnap.exists) {
      return res.status(404).json({ error: "not_found" });
    }

    const embedData = (embedSnap.data() || {}) as any;
    const storedRoomId = normalizeId(embedData.roomId);
    if (!storedRoomId || storedRoomId !== embedRoomId) {
      return res.status(400).json({
        error: "invalid_input",
        details: "embedRoomId does not match saved embed",
      });
    }

    await db
      .collection("rooms")
      .doc(ctx.roomId)
      .set(
        {
          activeEmbedId: embedId,
          activeEmbedRoomId: embedRoomId,
          activeEmbedUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

    return res.json({
      success: true,
      roomId: ctx.roomId,
      activeEmbedId: embedId,
      activeEmbedRoomId: embedRoomId,
    });
  } catch (err: any) {
    if (err instanceof RoomPermissionError) {
      return res.status(err.status).json({ error: err.code });
    }
    console.error("PUT /api/rooms/:roomId/active-embed error", err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
