import { Router } from "express";
import jwt from "jsonwebtoken";
import { firestore } from "../firebaseAdmin";
import { requireAuth, tryGetAuthUser, verifyInviteToken } from "../middleware/requireAuth";
import { resolveRoomIdentity } from "../lib/roomIdentity";
import { assertRoomPerm, RoomPermissionError } from "../lib/rolePermissions";

type InviteRole = "guest" | "cohost" | "moderator";

type InviteTokenClaims = {
  roomId: string;
  roomName: string;
  role: InviteRole;
  createdByUid?: string;
};

function getInviteSecret(): string {
  return process.env.INVITE_TOKEN_SECRET || process.env.JWT_SECRET || "dev-secret";
}

function requiresAuthForRole(role: InviteRole): boolean {
  return role === "cohost" || role === "moderator";
}

function normalizeRole(raw: unknown): InviteRole | null {
  const v = String(raw || "").toLowerCase();
  if (v === "guest" || v === "participant") return "guest";
  if (v === "cohost") return "cohost";
  if (v === "moderator") return "moderator";
  return null;
}

function normalizeRoomName(raw: unknown): string | null {
  const v = String(raw || "").trim();
  if (!v) return null;
  if (v.length > 200) return null;
  return v;
}

function normalizeRoomId(raw: unknown): string | null {
  const v = String(raw || "").trim();
  if (!v) return null;
  if (v.length > 200) return null;
  return v;
}

const router = Router();

/**
 * POST /api/invites/create
 * Body: { roomId, role }
 * Auth: required (host/streamer)
 * Returns: { inviteToken, url }
 */
router.post("/create", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user as { uid: string } | undefined;
    if (!user?.uid) return res.status(401).json({ error: "Unauthorized" });

    const requestedRoomId = normalizeRoomId((req.body as any)?.roomId);
    const role = normalizeRole((req.body as any)?.role);

    if (!requestedRoomId) return res.status(400).json({ error: "roomId_required" });
    if (!role) return res.status(400).json({ error: "role_disabled" });

    // Enforce that caller owns the room or has canInvite for this room.
    let roomName: string = requestedRoomId;
    try {
      const ctx = await assertRoomPerm(req as any, requestedRoomId, "canInvite");
      const roomDoc = ctx.room as any;
      roomName = normalizeRoomName(roomDoc?.roomName || roomDoc?.name || ctx.roomId) || ctx.roomId;
    } catch (err: any) {
      if (err instanceof RoomPermissionError) {
        return res.status(err.status).json({ error: err.code });
      }
      throw err;
    }

    const roomId = requestedRoomId;

    const claims: InviteTokenClaims = {
      roomId,
      roomName,
      role,
      createdByUid: user.uid,
    };

    const expiresIn = "30d";
    const inviteToken = jwt.sign(claims, getInviteSecret(), { expiresIn });

    // New canonical format: /join?t=<inviteToken>
    // Room pages should prefer /room/<roomId>?t=<inviteToken> when navigating
    // internally after resolving the invite.
    return res.json({
      inviteToken,
      url: `/join?t=${encodeURIComponent(inviteToken)}`,
      legacyUrl: `/i/${encodeURIComponent(inviteToken)}`,
      role,
      roomId,
      roomName,
      requiresAuth: false,
    });
  } catch (err: any) {
    console.error("/api/invites/create error", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /api/invites/resolve
 * Body: { inviteToken }
 * Auth: none
 * Returns: { roomName, role, requiresAuth }
 */
router.post("/resolve", async (req, res) => {
  try {
    const inviteToken = String((req.body as any)?.inviteToken || "").trim();
    if (!inviteToken) return res.status(400).json({ error: "inviteToken_required" });

    const claims = verifyInviteToken(inviteToken) as any;
    const roomId = normalizeRoomId(claims?.roomId);
    const roomName = normalizeRoomName(claims?.roomName || claims?.room);
    const role = normalizeRole(claims?.role || "guest") || "guest";

    if (!roomId && !roomName) return res.status(400).json({ error: "invite_room_missing" });

    const resolved = await resolveRoomIdentity({ roomId, roomName });
    if (!resolved) return res.status(400).json({ error: "invite_room_missing" });

    const requiresAuth = role === "cohost" || role === "moderator";

    return res.json({
      roomId: resolved.roomId,
      roomName: resolved.roomName,
      role,
      requiresAuth,
    });
  } catch (err: any) {
    console.error("/api/invites/resolve error", err?.message || err);
    return res.status(401).json({ error: "invalid_invite" });
  }
});

/**
 * POST /api/invites/accept
 * Body: { inviteToken }
 * Auth: required for cohost/moderator; guest does not require auth
 * Returns: { roomName, role, requiresAuth }
 */
router.post("/accept", async (req, res) => {
  try {
    const inviteToken = String((req.body as any)?.inviteToken || "").trim();
    if (!inviteToken) return res.status(400).json({ error: "inviteToken_required" });

    const claims = verifyInviteToken(inviteToken) as any;
    const roomId = normalizeRoomId(claims?.roomId);
    const roomName = normalizeRoomName(claims?.roomName || claims?.room);
    const role = normalizeRole(claims?.role || "guest") || "guest";

    if (!roomId && !roomName) return res.status(400).json({ error: "invite_room_missing" });

    const resolved = await resolveRoomIdentity({ roomId, roomName });
    if (!resolved) return res.status(400).json({ error: "invite_room_missing" });

    const user = tryGetAuthUser(req);

    if (user) {
      const docId = `${user.uid}_${Buffer.from(inviteToken).toString("base64url").slice(0, 40)}`;
      await firestore.collection("inviteAcceptances").doc(docId).set(
        {
          uid: user.uid,
          roomId: resolved.roomId,
          roomName: resolved.roomName,
          role,
          createdByUid: claims?.createdByUid || null,
          acceptedAt: new Date(),
        },
        { merge: true }
      );
    }

    const requiresAuth = role === "cohost" || role === "moderator";

    return res.json({
      roomId: resolved.roomId,
      roomName: resolved.roomName,
      role,
      requiresAuth,
    });
  } catch (err: any) {
    console.error("/api/invites/accept error", err?.message || err);
    return res.status(401).json({ error: "invalid_invite" });
  }
});

export default router;
