import { Router } from "express";
import { firestore } from "../firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";
import type { DestinationStatus, DestinationStatusReason, ApiErrorCode, DestinationItem, DestinationsGetResponse, DestinationPostResponse, ValidateRequestBody, ValidateResponse } from "../types/streaming";
import { decryptStreamKey, encryptStreamKey, normalizeRtmpBase } from "../lib/crypto";

const router = Router();

function deriveStatus(hasEnc: boolean, streamKeyDec: string | null, enabled: boolean): { status: DestinationStatus; statusReason?: DestinationStatusReason | null } {
  if (!hasEnc) {
    return { status: "needs_attention", statusReason: "missing_key" };
  }
  if (!streamKeyDec) {
    return { status: "needs_attention", statusReason: "invalid_format" };
  }
  if (!enabled) {
    return { status: "disconnected", statusReason: undefined };
  }
  return { status: "connected", statusReason: undefined };
}

function normalizeName(name?: string | null): string {
  return (name || "").trim().toLowerCase();
}

function toItem(doc: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>): DestinationItem {
  const data = (doc.data() as any) || {};
  const hasEnc = !!data.streamKeyEnc;
  const dec = hasEnc ? decryptStreamKey(data.streamKeyEnc) : null;
  const hasKey = !!dec;
  const keyPreview = dec ? dec.slice(-4) : null;
  const { status, statusReason } = deriveStatus(hasEnc, dec, !!data.enabled);
  return {
    id: doc.id,
    platform: String(data.platform || ""),
    name: data.name || undefined,
    enabled: !!data.enabled,
    rtmpUrlBase: String(data.rtmpUrlBase || ""),
    status,
    statusReason: statusReason ?? null,
    hasKey,
    keyPreview,
    updatedAt: Number(data.updatedAt || 0) || undefined,
  };
}

// GET /api/destinations?platform=youtube&includeDisabled=false
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "unauthorized" as ApiErrorCode });

    const platform = req.query.platform ? String(req.query.platform).trim().toLowerCase() : "";
    const includeDisabled = req.query.includeDisabled === "true" || req.query.includeDisabled === true ? true : false;

    let q = firestore.collection("users").doc(uid).collection("destinations") as FirebaseFirestore.CollectionReference;
    if (platform) {
      q = q.where("platform", "==", platform) as any;
    }
    if (!includeDisabled) {
      q = q.where("enabled", "==", true) as any;
    }
    const snap = await q.get();
    const items = snap.docs.map(toItem);

    // Optional: fetch plan limit
    let limit: number | undefined;
    const userSnap = await firestore.collection("users").doc(uid).get();
    const planId = String((userSnap.data() || {}).planId || "free");
    const planSnap = await firestore.collection("plans").doc(planId).get();
    if (planSnap.exists) {
      const limits = (planSnap.data() || {}).limits || {};
      limit = Number(limits.maxDestinations || 0) || undefined;
    }

    const payload: DestinationsGetResponse = { ok: true, items, usedCount: items.length, limit };
    return res.json(payload);
  } catch (err: any) {
    console.error("GET /api/destinations error:", err);
    return res.status(500).json({ error: "server_error" as ApiErrorCode, details: err?.message || String(err) });
  }
});

async function getPlanLimit(uid: string): Promise<number | undefined> {
  const userSnap = await firestore.collection("users").doc(uid).get();
  const planId = String((userSnap.data() || {}).planId || "free");
  const planSnap = await firestore.collection("plans").doc(planId).get();
  if (planSnap.exists) {
    const limits = (planSnap.data() || {}).limits || {};
    const limit = Number(limits.maxDestinations || 0) || undefined;
    return limit;
  }
  return undefined;
}

async function getEnabledCount(uid: string): Promise<number> {
  const snap = await firestore.collection("users").doc(uid).collection("destinations").where("enabled", "==", true).get();
  return snap.size;
}

// POST /api/destinations
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "unauthorized" as ApiErrorCode });
    const { platform, name, rtmpUrlBase, streamKeyEnc, streamKeyPlain, enabled } = req.body || {};
    if (!platform || !rtmpUrlBase) {
      return res.status(400).json({ error: "missing_required_fields" as ApiErrorCode, details: "platform and rtmpUrlBase are required" });
    }

    const normalizedBase = normalizeRtmpBase(String(rtmpUrlBase));
    const normalizedPlatform = String(platform).toLowerCase();
    const normalizedName = normalizeName(name);

    // Enforce plan limit for enabled destinations
    const planLimit = await getPlanLimit(uid);
    const enabledCount = await getEnabledCount(uid);
    const willBeEnabled = enabled === false ? false : true;
    if (willBeEnabled && planLimit !== undefined && planLimit > 0 && enabledCount >= planLimit) {
      return res.status(409).json({ error: "limit_exceeded" as ApiErrorCode });
    }

    // Resolve encrypted key: prefer freshly provided plaintext (server-encrypted),
    // otherwise allow callers to supply an already-encrypted payload.
    let finalEnc: any = streamKeyEnc || null;
    let plainKey: string | null = null;
    if (typeof streamKeyPlain === "string" && streamKeyPlain.trim()) {
      const trimmed = streamKeyPlain.trim();
      const enc = encryptStreamKey(trimmed);
      if (!enc) {
        return res.status(500).json({ error: "server_error" as ApiErrorCode, details: "stream key encryption is not configured" });
      }
      finalEnc = enc;
      plainKey = trimmed;
    } else if (streamKeyEnc) {
      plainKey = decryptStreamKey(streamKeyEnc as any);
    }

    // Duplicate rules:
    // 1) Names must be unique per platform (case-insensitive).
    // 2) Stream keys must be unique per platform (match on decrypted plaintext).
    const existingSnap = await firestore
      .collection("users")
      .doc(uid)
      .collection("destinations")
      .where("platform", "==", normalizedPlatform)
      .get();

    for (const doc of existingSnap.docs) {
      const data = doc.data() as any;
      const existingName = normalizeName(data?.name);
      if (normalizedName && normalizedName === existingName) {
        return res.status(409).json({ error: "duplicate_name" as ApiErrorCode });
      }
      if (plainKey) {
        const existingDec = data?.streamKeyEnc ? decryptStreamKey(data.streamKeyEnc) : null;
        if (existingDec && existingDec === plainKey) {
          return res.status(409).json({ error: "duplicate_stream_key" as ApiErrorCode });
        }
      }
    }

    // Build doc data
    const now = Date.now();
    const docData: any = {
      platform: normalizedPlatform,
      name: name ? String(name) : null,
      enabled: enabled === false ? false : true,
      rtmpUrlBase: normalizedBase,
      streamKeyEnc: finalEnc || null,
      updatedAt: now,
    };

    const col = firestore.collection("users").doc(uid).collection("destinations");
    const createdRef = await col.add(docData);
    const createdSnap = await createdRef.get();
    const destination = toItem(createdSnap);

    const usedCount = await getEnabledCount(uid);
    const limit = planLimit;
    const payload: DestinationPostResponse = {
      ok: true,
      destination,
      validation: { status: destination.status, statusReason: destination.statusReason ?? null },
      usedCount,
      limit,
    };
    return res.status(201).json(payload);
  } catch (err: any) {
    console.error("POST /api/destinations error:", err);
    return res.status(500).json({ error: "server_error" as ApiErrorCode, details: err?.message || String(err) });
  }
});

// POST /api/destinations/validate (pre-create)
router.post("/validate", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "unauthorized" as ApiErrorCode });
    const body: ValidateRequestBody = req.body || ({} as any);
    if (!body.platform || !body.rtmpUrlBase) {
      return res.status(400).json({ error: "missing_required_fields" as ApiErrorCode });
    }
    const normalizedBase = normalizeRtmpBase(body.rtmpUrlBase);
    let dec: string | null = null;
    let hasEnc = false;
    if (typeof body.streamKeyPlain === "string" && body.streamKeyPlain.trim()) {
      dec = body.streamKeyPlain.trim();
      hasEnc = true;
    } else if (body.streamKeyEnc) {
      dec = decryptStreamKey(body.streamKeyEnc as any);
      hasEnc = !!body.streamKeyEnc;
    }
    const { status, statusReason } = deriveStatus(hasEnc, dec, true);
    const payload: ValidateResponse = { ok: true, status, statusReason: statusReason ?? null };
    return res.json(payload);
  } catch (err: any) {
    console.error("POST /api/destinations/validate error:", err);
    return res.status(500).json({ error: "server_error" as ApiErrorCode, details: err?.message || String(err) });
  }
});

// POST /api/destinations/:id/validate (validate existing; does not update)
router.post("/:id/validate", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "unauthorized" as ApiErrorCode });
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "invalid_query" as ApiErrorCode });

    const ref = firestore.collection("users").doc(uid).collection("destinations").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "destination_not_found" as ApiErrorCode });
    const item = toItem(snap);
    const payload: ValidateResponse = { ok: true, status: item.status, statusReason: item.statusReason ?? null };
    return res.json(payload);
  } catch (err: any) {
    console.error("POST /api/destinations/:id/validate error:", err);
    return res.status(500).json({ error: "server_error" as ApiErrorCode, details: err?.message || String(err) });
  }
});

// PUT /api/destinations/:id
router.put("/:id", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "unauthorized" as ApiErrorCode });
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "invalid_query" as ApiErrorCode });
    const updates = req.body || {};

    const ref = firestore.collection("users").doc(uid).collection("destinations").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "destination_not_found" as ApiErrorCode });
    const current = snap.data() as any;

    let nextPlatform = typeof updates.platform === "string" ? String(updates.platform).toLowerCase() : current.platform;
    let nextBase = typeof updates.rtmpUrlBase === "string" ? normalizeRtmpBase(String(updates.rtmpUrlBase)) : current.rtmpUrlBase;
    const nextNameNorm = normalizeName(typeof updates.name === "string" ? updates.name : current.name);

    // Resolve encrypted key updates. If a new plaintext key is provided, encrypt
    // and store it. If streamKeyEnc is explicitly provided, honor it. Otherwise
    // keep the existing value.
    let nextEnc: any = current.streamKeyEnc ?? null;
    let nextPlainKey: string | null = null;
    if (typeof updates.streamKeyPlain === "string") {
      const trimmed = updates.streamKeyPlain.trim();
      if (trimmed) {
        const enc = encryptStreamKey(trimmed);
        if (!enc) {
          return res.status(500).json({ error: "server_error" as ApiErrorCode, details: "stream key encryption is not configured" });
        }
        nextEnc = enc;
        nextPlainKey = trimmed;
      } else {
        // Empty string clears the key
        nextEnc = null;
        nextPlainKey = null;
      }
    } else if (Object.prototype.hasOwnProperty.call(updates, "streamKeyEnc")) {
      nextEnc = updates.streamKeyEnc ?? null;
      nextPlainKey = updates.streamKeyEnc ? decryptStreamKey(updates.streamKeyEnc as any) : null;
    } else if (current.streamKeyEnc) {
      nextPlainKey = decryptStreamKey(current.streamKeyEnc);
    }

    // Duplicate rules on update (exclude current doc):
    // 1) Names unique per platform.
    // 2) Stream keys unique per platform.
    const existingSnap = await firestore
      .collection("users")
      .doc(uid)
      .collection("destinations")
      .where("platform", "==", nextPlatform)
      .get();

    for (const doc of existingSnap.docs) {
      if (doc.id === id) continue;
      const data = doc.data() as any;
      const existingName = normalizeName(data?.name);
      if (nextNameNorm && nextNameNorm === existingName) {
        return res.status(409).json({ error: "duplicate_name" as ApiErrorCode });
      }
      if (nextPlainKey) {
        const existingDec = data?.streamKeyEnc ? decryptStreamKey(data.streamKeyEnc) : null;
        if (existingDec && existingDec === nextPlainKey) {
          return res.status(409).json({ error: "duplicate_stream_key" as ApiErrorCode });
        }
      }
    }

    // Enforce plan limit if toggling enabled from false to true
    const planLimit = await getPlanLimit(uid);
    const enabledCount = await getEnabledCount(uid);
    const currentEnabled = !!current.enabled;
    const nextEnabled = typeof updates.enabled === "boolean" ? !!updates.enabled : currentEnabled;
    if (!currentEnabled && nextEnabled && planLimit !== undefined && planLimit > 0 && enabledCount >= planLimit) {
      return res.status(409).json({ error: "limit_exceeded" as ApiErrorCode });
    }

    const docData: any = {
      platform: nextPlatform,
      rtmpUrlBase: nextBase,
      name: typeof updates.name === "string" ? String(updates.name) : (current.name || null),
      enabled: typeof updates.enabled === "boolean" ? !!updates.enabled : !!current.enabled,
      streamKeyEnc: nextEnc,
      updatedAt: Date.now(),
    };
    await ref.set(docData, { merge: true });
    const updatedSnap = await ref.get();
    const destination = toItem(updatedSnap);
    const usedCount = await getEnabledCount(uid);
    return res.json({ ok: true, destination, usedCount, limit: planLimit });
  } catch (err: any) {
    console.error("PUT /api/destinations/:id error:", err);
    return res.status(500).json({ error: "server_error" as ApiErrorCode, details: err?.message || String(err) });
  }
});

// DELETE /api/destinations/:id
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "unauthorized" as ApiErrorCode });
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "invalid_query" as ApiErrorCode });

    const ref = firestore.collection("users").doc(uid).collection("destinations").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "destination_not_found" as ApiErrorCode });
    await ref.delete();
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/destinations/:id error:", err);
    return res.status(500).json({ error: "server_error" as ApiErrorCode, details: err?.message || String(err) });
  }
});

export default router;
