import { Router } from "express";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import { firestore } from "../firebaseAdmin";
import { tryGetAuthUser } from "../middleware/requireAuth";
import { tryGetGuestSession } from "../middleware/guestSession";
import { sanitizeDisplayName } from "../lib/sanitizeDisplayName";
import { PERMISSION_ERRORS } from "../lib/permissionErrors";
import { signGuestSession } from "../middleware/guestSession";

async function getAccessTokenCtor() {
  const mod = await import("livekit-server-sdk");
  return mod.AccessToken;
}

function getLiveKitServerUrlForClient(): string | null {
  const raw = String(process.env.LIVEKIT_URL || "").trim();
  if (!raw) return null;
  // LiveKit client expects ws(s) URLs. Allow operators to configure https(s)
  // and normalize it safely.
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
  }
  return raw;
}

function getRoomAccessSecret() {
  const env = String(process.env.NODE_ENV || "development").toLowerCase();
  const explicit = process.env.ROOM_ACCESS_TOKEN_SECRET;
  const fallback = process.env.JWT_SECRET;
  const raw = String(explicit || fallback || "").trim();

  // In production/staging we require a real secret, but we allow falling back to
  // JWT_SECRET for backwards compatibility with older deployments.
  if (env === "production" || env === "staging") {
    if (!raw || raw === "dev-secret") {
      throw new Error("ROOM_ACCESS_TOKEN_SECRET (or JWT_SECRET) must be set (no dev-secret in production)");
    }
    if (!explicit && process.env.AUTH_DEBUG === "1") {
      console.warn("[roomGuestAccess] Using JWT_SECRET fallback for ROOM_ACCESS_TOKEN_SECRET");
    }
  }

  return raw || "dev-secret";
}

function roleGrant(role: "viewer" | "participant" | "host") {
  if (role === "viewer") {
    return {
      roomJoin: true,
      canSubscribe: true,
      canPublish: false,
      canPublishData: false,
      canPublishSources: [],
      roomAdmin: false,
      canUpdateMetadata: false,
    } as const;
  }

  if (role === "host") {
    return {
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      canPublishSources: ["MICROPHONE", "CAMERA", "SCREEN_SHARE", "SCREEN_SHARE_AUDIO"],
      roomAdmin: false,
      canUpdateMetadata: false,
    } as const;
  }

  // participant
  return {
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
    canPublishSources: ["MICROPHONE", "CAMERA"],
    roomAdmin: false,
    canUpdateMetadata: false,
  } as const;
}

const router = Router();

// Simple, best-effort in-memory IP rate limiter for invite redemption.
// This is not perfect in multi-instance deployments, but it stops obvious abuse.
const redeemIpWindowMs = 60_000;
const redeemIpMax = 12;
const redeemIpHits = new Map<string, { count: number; resetAt: number }>();

function hitRedeemRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip || "unknown";
  const existing = redeemIpHits.get(key);
  if (!existing || now >= existing.resetAt) {
    redeemIpHits.set(key, { count: 1, resetAt: now + redeemIpWindowMs });
    return false;
  }
  existing.count += 1;
  if (existing.count > redeemIpMax) return true;
  return false;
}

/**
 * POST /api/invites/:inviteId/redeem
 * Auth: none
 * Sets: HttpOnly cookie sl_guest=<signedJWT>
 * Returns: { roomId }
 */
router.post("/invites/:inviteId/redeem", async (req: any, res) => {
  try {
    const inviteId = String(req.params.inviteId || "").trim();
    if (!inviteId) return res.status(400).json({ error: "inviteId_required" });

    const ip = String(req.ip || "");
    if (hitRedeemRateLimit(ip)) {
      return res.status(429).json({ error: "rate_limited" });
    }

    const inviteRef = firestore.collection("roomInvites").doc(inviteId);

    const result = await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(inviteRef);
      if (!snap.exists) {
        return { ok: false as const, status: 404 as const, error: "invite_not_found" };
      }

      const data = (snap.data() as any) || {};
      const roomId = String(data.roomId || "").trim();
      if (!roomId) {
        return { ok: false as const, status: 409 as const, error: "invite_room_missing" };
      }

      if (data.revokedAt) {
        return { ok: false as const, status: 403 as const, error: "invite_revoked" };
      }

      const expiresAtMs = (data.expiresAt as any)?.toMillis?.() ?? null;
      if (expiresAtMs && expiresAtMs < Date.now()) {
        return { ok: false as const, status: 410 as const, error: "invite_expired" };
      }

      const maxUses = data.maxUses ?? null;
      const useCount = Number(data.useCount || 0);
      if (maxUses !== null && Number(maxUses) > 0 && useCount >= Number(maxUses)) {
        return { ok: false as const, status: 410 as const, error: "invite_max_used" };
      }

      tx.update(inviteRef, {
        useCount: useCount + 1,
        lastRedeemedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { ok: true as const, roomId };
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const expiresIn = "2h";
    const sessionJwt = signGuestSession({ inviteId, roomId: result.roomId, role: "viewer" }, expiresIn);

    const secure = String(process.env.NODE_ENV || "development").toLowerCase() === "production";
    res.cookie("sl_guest", sessionJwt, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 2 * 60 * 60 * 1000,
    });

    return res.json({ roomId: result.roomId });
  } catch (err: any) {
    console.error("/api/invites/:inviteId/redeem error", err?.message || err);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /api/rooms/:roomId/status
 * Auth: host auth OR guest session cookie required
 * Returns: { roomId, status: "idle" | "live" }
 */
router.get("/rooms/:roomId/status", async (req: any, res) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    if (!roomId) return res.status(400).json({ error: "roomId_required" });

    const user = tryGetAuthUser(req);
    const guest = tryGetGuestSession(req);

    if (!user && (!guest || guest.roomId !== roomId)) {
      return res.status(401).json({ error: PERMISSION_ERRORS.UNAUTHORIZED });
    }

    const snap = await firestore.collection("rooms").doc(roomId).get();
    if (!snap.exists) return res.status(404).json({ error: PERMISSION_ERRORS.ROOM_NOT_FOUND });

    const room = (snap.data() as any) || {};
    const status = room.status === "live" ? "live" : "idle";

    return res.json({ roomId, status });
  } catch (err) {
    console.error("/api/rooms/:roomId/status error", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /api/rooms/:roomId/token
 * Auth:
 *  - Host/cohost (authed): allowed anytime
 *  - Guest session: only when rooms/{roomId}.status === "live"; mints viewer-only token
 */
router.post("/rooms/:roomId/token", async (req: any, res) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    if (!roomId) return res.status(400).json({ error: "roomId_required" });

    const user = tryGetAuthUser(req);
    const guest = tryGetGuestSession(req);

    if (!user && (!guest || guest.roomId !== roomId)) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const snap = await firestore.collection("rooms").doc(roomId).get();
    if (!snap.exists) return res.status(404).json({ error: PERMISSION_ERRORS.ROOM_NOT_FOUND });

    const room = (snap.data() as any) || {};
    const ownerId = typeof room.ownerId === "string" ? room.ownerId.trim() : "";
    const livekitRoomName = String(room.livekitRoomName || roomId).trim();
    const roomStatus = room.status === "live" ? "live" : "idle";

    // Guests can only join once room is live.
    if (!user && roomStatus !== "live") {
      return res.status(409).json({ error: "room_not_live" });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: "LiveKit keys missing in env" });
    }

    const displayName = sanitizeDisplayName(String(req.body?.displayName || req.body?.identity || "Viewer")).trim() || "Viewer";

    const isHost = !!user && ownerId && user.uid === ownerId;
    const lkRole: "viewer" | "participant" | "host" = user ? (isHost ? "host" : "participant") : "viewer";
    const identity = user ? user.uid : `invite:${guest!.inviteId}:${Math.random().toString(16).slice(2)}`;

    // When host joins, flip room live.
    if (user && isHost && roomStatus !== "live") {
      await firestore.collection("rooms").doc(roomId).set(
        {
          status: "live",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const AccessToken = await getAccessTokenCtor();
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: displayName,
    });

    const grant = roleGrant(lkRole);
    at.addGrant({ room: livekitRoomName, ...grant } as any);

    const token = await at.toJwt();

    const roomAccessPayload = {
      roomId,
      roomName: String(room.roomName || room.name || livekitRoomName || roomId),
      livekitRoomName,
      role: lkRole === "viewer" ? "viewer" : "participant",
      permissions: {
        canStream: lkRole !== "viewer",
        canRecord: lkRole !== "viewer",
        canDestinations: lkRole !== "viewer",
        canModerate: lkRole === "host",
        canLayout: lkRole !== "viewer",
        canScreenShare: lkRole !== "viewer",
        canInvite: lkRole === "host",
        canAnalytics: false,
      },
      identity,
    } as const;

    const roomAccessToken = jwt.sign(roomAccessPayload, getRoomAccessSecret(), { expiresIn: "12h" });

    const serverUrl = getLiveKitServerUrlForClient();

    return res.json({
      token,
      serverUrl,
      roomId,
      roomName: roomAccessPayload.roomName,
      roomAccessToken,
      isViewer: lkRole === "viewer",
      role: lkRole,
      effectiveRoleKey: lkRole === "viewer" ? "viewer" : "participant",
    });
  } catch (err: any) {
    console.error("/api/rooms/:roomId/token error", err?.message || err);
    return res.status(500).json({ error: "Failed to create room token" });
  }
});

export default router;
