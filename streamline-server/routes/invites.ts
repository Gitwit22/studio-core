import { Router } from "express";
import jwt from "jsonwebtoken";
import { firestore } from "../firebaseAdmin";
import { tryGetAuthUser, verifyInviteToken } from "../middleware/requireAuth";

type InviteRole = "guest" | "cohost" | "moderator";

type InviteTokenClaims = {
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
  // Invites are currently guest/participant-only.
  if (v === "guest" || v === "participant") return "guest";
  if (v === "cohost" || v === "moderator") return null;
  return null;
}

function normalizeRoomName(raw: unknown): string | null {
  const v = String(raw || "").trim();
  if (!v) return null;
  if (v.length > 200) return null;
  return v;
}

const router = Router();

/**
 * POST /api/invites/create
 * Body: { roomName, role }
 * Auth: required (host/streamer)
 * Returns: { inviteToken, url }
 */
router.post("/create", async (req, res) => {
  try {
    const user = tryGetAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const roomName = normalizeRoomName((req.body as any)?.roomName);
    const role = normalizeRole((req.body as any)?.role);

    if (!roomName) return res.status(400).json({ error: "roomName_required" });
    if (!role) return res.status(400).json({ error: "role_disabled" });

    const claims: InviteTokenClaims = {
      roomName,
      role,
      createdByUid: user.uid,
    };

    const expiresIn = "30d";
    const inviteToken = jwt.sign(claims, getInviteSecret(), { expiresIn });

    return res.json({
      inviteToken,
      url: `/i/${encodeURIComponent(inviteToken)}`,
      role,
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
    const roomName = normalizeRoomName(claims?.roomName || claims?.room);
    const role = normalizeRole(claims?.role || "guest") || "guest";

    if (!roomName) return res.status(400).json({ error: "invite_room_missing" });

    return res.json({
      roomName,
      role,
      requiresAuth: false,
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
    const roomName = normalizeRoomName(claims?.roomName || claims?.room);
    const role = normalizeRole(claims?.role || "guest") || "guest";

    if (!roomName) return res.status(400).json({ error: "invite_room_missing" });

    const user = tryGetAuthUser(req);

    if (user) {
      const docId = `${user.uid}_${Buffer.from(inviteToken).toString("base64url").slice(0, 40)}`;
      await firestore.collection("inviteAcceptances").doc(docId).set(
        {
          uid: user.uid,
          roomName,
          role,
          createdByUid: claims?.createdByUid || null,
          acceptedAt: new Date(),
        },
        { merge: true }
      );
    }

    return res.json({
      roomName,
      role,
      requiresAuth: false,
    });
  } catch (err: any) {
    console.error("/api/invites/accept error", err?.message || err);
    return res.status(401).json({ error: "invalid_invite" });
  }
});

export default router;
