import { Router } from "express";
import { firestore } from "../firebaseAdmin";
import { requireAdmin } from "../middleware/adminAuth";
import { deleteFiles, deletePrefix } from "../lib/storageClient";

const router = Router();

type EmergencyCurrentDoc = {
  recordingId?: string;
  createdAt?: any;
  expiresAt?: any;
  status?: string;
  r2Keys?: string[];
  r2Prefix?: string;
  deletedAt?: any;
};

function getUidFromEmergencyCurrentPath(path: string): string | null {
  // Expected: users/{uid}/emergencyRecording/current
  const parts = String(path || "").split("/").filter(Boolean);
  if (parts.length !== 4) return null;
  if (parts[0] !== "users") return null;
  if (parts[2] !== "emergencyRecording") return null;
  return parts[1] || null;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  return null;
}

// Admin-only maintenance endpoints (Render cron-friendly)
//
// Supports two auth mechanisms:
// 1) Standard admin auth via requireAdmin (JWT/cookie/body)
// 2) Static maintenance key for cron jobs: header x-maintenance-key or Authorization: Bearer <key>
router.use((req, res, next) => {
  const key = process.env.MAINTENANCE_KEY;
  if (!key) return requireAdmin(req, res, next);

  const headerKey = String(req.headers["x-maintenance-key"] || "").trim();
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  const bearer =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

  if (headerKey && headerKey === key) return next();
  if (bearer && bearer === key) return next();

  return requireAdmin(req, res, next);
});

async function expireEmergencyRecordings(now: Date): Promise<{ deletedCount: number }> {
  const snap = await firestore
    .collectionGroup("emergencyRecording")
    .where("expiresAt", "<", now)
    .limit(500)
    .get();

  let deletedCount = 0;

  for (const doc of snap.docs) {
    if (doc.id !== "current") continue;

    const data = (doc.data() || {}) as EmergencyCurrentDoc;
    const status = String(data.status || "").toLowerCase();
    if (status === "deleted") continue;

    const expiresAt = toDate(data.expiresAt);
    if (!expiresAt || expiresAt.getTime() >= now.getTime()) continue;

    const uid = getUidFromEmergencyCurrentPath(doc.ref.path);
    const recordingId = data.recordingId ? String(data.recordingId) : null;

    try {
      // Delete R2 assets (idempotent)
      const keys = Array.isArray(data.r2Keys) ? data.r2Keys.map(String).map((s) => s.trim()).filter(Boolean) : [];
      const prefix = data.r2Prefix ? String(data.r2Prefix).trim() : "";

      if (keys.length > 0) {
        await deleteFiles(keys);
      } else if (prefix) {
        await deletePrefix(prefix);
      }

      // Mark pointer deleted
      await doc.ref.set(
        {
          status: "deleted",
          deletedAt: now,
        },
        { merge: true }
      );

      // Best-effort: mark recording doc deleted as well
      if (recordingId) {
        await firestore
          .collection("recordings")
          .doc(recordingId)
          .set({ status: "deleted", deletedAt: now, updatedAt: now }, { merge: true });
      }

      // Best-effort: annotate user doc so we can audit deletions later
      if (uid) {
        await firestore
          .collection("users")
          .doc(uid)
          .set({ lastEmergencyRecordingExpiredAt: now }, { merge: true });
      }

      deletedCount += 1;
    } catch (e: any) {
      console.warn("[maintenance/expire-emergency-recordings] failed for", doc.ref.path, e?.message || e);
    }
  }

  return { deletedCount };
}

router.get("/expire-emergency-recordings", async (_req, res) => {
  const now = new Date();
  const { deletedCount } = await expireEmergencyRecordings(now);
  return res.json({ ok: true, deletedCount });
});

router.post("/expire-emergency-recordings", async (_req, res) => {
  const now = new Date();
  const { deletedCount } = await expireEmergencyRecordings(now);
  return res.json({ ok: true, deletedCount });
});

export default router;
