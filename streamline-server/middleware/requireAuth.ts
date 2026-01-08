// StreamLine uses custom auth UID (JWT) as canonical user identity.
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

type AuthUser = { uid: string };

export type InviteClaims = {
  roomName?: string;
  room?: string;
  identity?: string;
  uid?: string;
  sub?: string;
};

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-secret";
}

export function tryGetAuthUser(req: Request): AuthUser | null {
  const rawToken =
    (req as any).cookies?.token ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!rawToken) return null;

  const decoded = jwt.verify(rawToken, getJwtSecret()) as { uid: string };
  return { uid: decoded.uid };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = tryGetAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    (req as any).user = user;
    return next();
  } catch (err) {
    console.error("[requireAuth] Unauthorized:", (err as any)?.message || err);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function verifyInviteToken(rawInviteToken: string): InviteClaims {
  const secret = process.env.INVITE_TOKEN_SECRET || getJwtSecret();
  if (!secret) {
    throw new Error("Invite token secret not configured");
  }
  const decoded = jwt.verify(rawInviteToken, secret) as InviteClaims;
  return decoded;
}

export function requireAuthOrInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const user = tryGetAuthUser(req);
    if (user) {
      (req as any).user = user;
      return next();
    }
  } catch (err) {
    // continue to invite token validation
    console.warn("[requireAuthOrInvite] Auth token invalid, checking invite token");
  }

  const inviteToken =
    (req.headers["x-invite-token"] as string | undefined) ||
    (req.body as any)?.inviteToken ||
    (req.query as any)?.inviteToken;

  if (!inviteToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const claims = verifyInviteToken(inviteToken);
    (req as any).invite = claims;
    return next();
  } catch (err) {
    console.error("[requireAuthOrInvite] Invite token invalid:", (err as any)?.message || err);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
