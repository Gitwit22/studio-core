import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type RoomAccessClaims = {
  roomId: string;
  roomName?: string;
  role?: string;
  permissions?: Record<string, boolean>;
};

function getRoomAccessSecret(): string {
  const env = String(process.env.NODE_ENV || "development").toLowerCase();
  const raw = process.env.ROOM_ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "";
  if ((env === "production" || env === "staging") && (!process.env.ROOM_ACCESS_TOKEN_SECRET || raw === "dev-secret")) {
    throw new Error("ROOM_ACCESS_TOKEN_SECRET must be set (no dev-secret in production)");
  }
  return raw || "dev-secret";
}

export function verifyRoomAccessToken(rawToken: string): RoomAccessClaims {
  const decoded = jwt.verify(rawToken, getRoomAccessSecret());
  return decoded as RoomAccessClaims;
}

export function extractRoomAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  const headerToken = req.headers["x-room-access-token"] as string | undefined;
  if (headerToken && headerToken.trim()) {
    return headerToken.trim();
  }

  const fromQuery = (req.query as any)?.t as string | undefined;
  if (fromQuery && typeof fromQuery === "string" && fromQuery.trim()) {
    return fromQuery.trim();
  }

  return null;
}

export function requireRoomAccessToken(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = extractRoomAccessToken(req);
    if (!raw) {
      return res.status(401).json({ error: "room_token_required" });
    }

    const claims = verifyRoomAccessToken(raw);
    if (!claims || !claims.roomId) {
      return res.status(401).json({ error: "invalid_room_token" });
    }

    (req as any).roomAccess = claims;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "invalid_room_token" });
  }
}
