import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Normalize uid so other code can rely on req.user.uid
  const uid = user.uid || user.id;

  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Ensure we always have uid present
  (req as any).user = { ...user, uid };

  next();
}
