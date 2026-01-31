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

async function deleteCollection(ref: FirebaseFirestore.CollectionReference, limit: number = 200) {
  const snap = await ref.limit(limit).get();
  if (snap.empty) return 0;
  const batch = firestore.batch();
  for (const doc of snap.docs) batch.delete(doc.ref);
  await batch.commit();
  return snap.size;
}

async function purgeDeletedAccounts(now: Date): Promise<{ purgedCount: number }> {
  const nowMs = now.getTime();
  const snap = await firestore
    .collection("users")
    .where("deleteAfterMs", "<=", nowMs)
    .limit(50)
    .get();

  let purgedCount = 0;

  for (const doc of snap.docs) {
    const uid = doc.id;
    const data = (doc.data() as any) || {};
    const deletedAtMs = typeof data.deletedAtMs === "number" ? data.deletedAtMs : null;
    const deleteAfterMs = typeof data.deleteAfterMs === "number" ? data.deleteAfterMs : null;

    if (!deletedAtMs || !deleteAfterMs || deleteAfterMs > nowMs) continue;

    try {
      // Best-effort cleanup of known user-owned data.
      // Note: Firestore does not automatically delete subcollections.

      // users/{uid}/rolePresets
      try {
        let removed = 0;
        // Loop in case there are >limit docs
        for (let i = 0; i < 5; i++) {
          const n = await deleteCollection(doc.ref.collection("rolePresets"), 200);
          removed += n;
          if (n === 0) break;
        }
        if (removed) {
          console.log("[maintenance] purged rolePresets", { uid, removed });
        }
      } catch {}

      // users/{uid}/emergencyRecording
      try {
        let removed = 0;
        for (let i = 0; i < 5; i++) {
          const n = await deleteCollection(doc.ref.collection("emergencyRecording"), 200);
          removed += n;
          if (n === 0) break;
        }
        if (removed) {
          console.log("[maintenance] purged emergencyRecording", { uid, removed });
        }
      } catch {}

      // accounts/{uid}
      try {
        await firestore.collection("accounts").doc(uid).delete();
      } catch {}

      // billingAudit where uid == uid (best-effort, small batches)
      try {
        for (let i = 0; i < 5; i++) {
          const auditSnap = await firestore
            .collection("billingAudit")
            .where("uid", "==", uid)
            .limit(200)
            .get();
          if (auditSnap.empty) break;
          const batch = firestore.batch();
          for (const a of auditSnap.docs) batch.delete(a.ref);
          await batch.commit();
        }
      } catch {}

      // Finally: delete the primary user doc.
      await doc.ref.delete();
      purgedCount += 1;
    } catch (e: any) {
      console.warn("[maintenance/purge-deleted-accounts] failed for", uid, e?.message || e);
    }
  }

  return { purgedCount };
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

router.get("/purge-deleted-accounts", async (_req, res) => {
  const now = new Date();
  const { purgedCount } = await purgeDeletedAccounts(now);
  return res.json({ ok: true, purgedCount });
});

router.post("/purge-deleted-accounts", async (_req, res) => {
  const now = new Date();
  const { purgedCount } = await purgeDeletedAccounts(now);
  return res.json({ ok: true, purgedCount });
});

export default router;
