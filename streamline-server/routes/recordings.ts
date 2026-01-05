/**
 * StreamLine Recordings API
 * 
 * Reliable recording pipeline with:
 * - Immediate Firestore doc creation on start
 * - LiveKit Cloud egress to Cloudflare R2
 * - Proper status transitions: starting → recording → processing → ready
 * - Safe download endpoint with signed URLs
 * 
 * Routes (matching existing frontend calls):
 * - POST /api/recordings/start
 * - POST /api/recordings/stop
 * - GET /api/recordings/emergency-latest
 * - GET /api/recordings/:id
 * - GET /api/recordings/:id/download-link
 * - GET /api/recordings/:id/download
 * - GET /api/recordings/:id/storage-check
 * - POST /api/recordings/:id/report-download-issue
 */

import { Router } from "express";
import { firestore } from "../firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { canAccessFeature } from "./featureAccess";
import { Timestamp } from "firebase-admin/firestore";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const router = Router();

// =============================================================================
// ENVIRONMENT & CONFIG
// =============================================================================

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * Normalize LiveKit URL for egress client (must be HTTP/HTTPS, not WS)
 */
function normalizeLiveKitUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://");
}

/**
 * Validate all required env vars at module load time
 */
function validateEnvVars() {
  const required = [
    "R2_BUCKET",
    "R2_ACCESS_KEY_ID", 
    "R2_SECRET_ACCESS_KEY",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
  ];
  
  const hasR2Endpoint = process.env.R2_ACCOUNT_ID || process.env.R2_ENDPOINT;
  const hasLiveKitUrl = process.env.LIVEKIT_URL || process.env.LIVEKIT_HTTP_URL;

  const missing: string[] = [];
  for (const name of required) {
    if (!process.env[name]) missing.push(name);
  }
  if (!hasR2Endpoint) missing.push("R2_ACCOUNT_ID or R2_ENDPOINT");
  if (!hasLiveKitUrl) missing.push("LIVEKIT_URL or LIVEKIT_HTTP_URL");

  if (missing.length > 0) {
    console.error("[recordings] ❌ Missing required env vars:", missing.join(", "));
  } else {
    // Log normalized URLs at startup
    const normalizedUrl = normalizeLiveKitUrl(process.env.LIVEKIT_HTTP_URL || process.env.LIVEKIT_URL);
    console.log("[recordings] ✓ Env vars validated");
    console.log("[recordings] LiveKit egress URL:", normalizedUrl);
  }
}

// Validate on module load
validateEnvVars();

function getR2Config() {
  const bucket = mustGetEnv("R2_BUCKET");
  const accessKeyId = mustGetEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = mustGetEnv("R2_SECRET_ACCESS_KEY");
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : mustGetEnv("R2_ENDPOINT");

  return { bucket, accessKeyId, secretAccessKey, endpoint };
}

function getLiveKitConfig() {
  // Use normalization function for consistency
  const url = normalizeLiveKitUrl(process.env.LIVEKIT_HTTP_URL || process.env.LIVEKIT_URL);
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  return { url, apiKey, apiSecret, isConfigured: !!(url && apiKey && apiSecret) };
}

// Lazy SDK loader
let _livekitSdk: any = null;
async function getLiveKitSdk() {
  if (_livekitSdk) return _livekitSdk;
  _livekitSdk = await import("livekit-server-sdk");
  return _livekitSdk;
}

// Lazy S3 client
let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (_s3Client) return _s3Client;
  const cfg = getR2Config();
  _s3Client = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: true,
  });
  return _s3Client;
}

// =============================================================================
// HELPERS
// =============================================================================

const DEFAULT_RETENTION_MINUTES = 30;

function computeExpiry(
  readyAt?: Timestamp | Date | null,
  retentionMinutes: number = DEFAULT_RETENTION_MINUTES
): Date | null {
  if (!readyAt) return null;
  const readyDate = readyAt instanceof Timestamp ? readyAt.toDate() : readyAt;
  return new Date(readyDate.getTime() + retentionMinutes * 60 * 1000);
}

function isExpired(readyAt?: Timestamp | Date | null, retentionMinutes?: number): boolean {
  const expires = computeExpiry(readyAt, retentionMinutes);
  return expires ? Date.now() >= expires.getTime() : false;
}

function mapRecordingDoc(id: string, data: any) {
  const status = data.status || "unknown";
  const downloadReady = !!(data.downloadReady || status === "ready" || status === "stopped");
  return {
    id,
    status,
    downloadReady,
    path: data.downloadPath || data.objectKey || null,
    startedAt: data.startedAt || null,
    stoppedAt: data.stoppedAt || null,
    duration: data.duration || 0,
    fileSize: data.fileSize || null,
  };
}

function getAuthUserId(req: any): string | null {
  return req.user?.uid || req.user?.id || null;
}

/**
 * Generate recording path for R2
 * CRITICAL: No leading slash - use "recordings/..." not "/recordings/..."
 */
function generateRecordingPath(userId: string, roomName: string, timestamp: number): string {
  const safeRoom = roomName.replace(/[^a-zA-Z0-9_-]/g, "_");
  // Ensure no leading slash - R2/S3 keys should not start with /
  return `recordings/${userId}/${safeRoom}/${timestamp}.mp4`;
}

/**
 * HEAD check on R2 to verify object exists and get size
 */
async function r2HeadObjectSize(key: string): Promise<number> {
  try {
    const cfg = getR2Config();
    const client = getS3Client();
    const resp = await client.send(
      new HeadObjectCommand({ Bucket: cfg.bucket, Key: key })
    );
    return typeof resp.ContentLength === "number" ? resp.ContentLength : 0;
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return 0;
    }
    console.error(`[r2] HEAD error for ${key}:`, err?.message);
    return 0;
  }
}

/**
 * Generate signed download URL
 */
async function getSignedDownloadUrl(key: string, expiresIn: number = 300): Promise<string> {
  const cfg = getR2Config();
  const client = getS3Client();
  const command = new GetObjectCommand({ Bucket: cfg.bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

// =============================================================================
// POST /start - Start Recording
// =============================================================================

router.post("/start", requireAuth, async (req, res) => {
  const startTime = Date.now();
  console.log("[recordings/start] Request received");

  try {
    const uid = getAuthUserId(req);
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Feature access gate
    const access = await canAccessFeature(uid, "recording");
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        error: access.reason || "Recording requires upgrade",
      });
    }

    // Validate request
    const { roomName, layout: rawLayout } = req.body as {
      roomName?: string;
      layout?: string;
    };

    if (!roomName) {
      return res.status(400).json({ error: "roomName is required" });
    }

    // CRITICAL: Layout must be exactly "speaker" or "grid" - anything else causes 400
    const layout = rawLayout === "speaker" ? "speaker" : "grid";

    // Check configs
    const livekitCfg = getLiveKitConfig();
    if (!livekitCfg.isConfigured) {
      console.error("[recordings/start] LiveKit env missing");
      return res.status(500).json({ error: "LiveKit not configured" });
    }

    let r2Cfg;
    try {
      r2Cfg = getR2Config();
    } catch (e: any) {
      console.error("[recordings/start] R2 env missing:", e?.message);
      return res.status(500).json({ error: "R2 storage not configured" });
    }

    // Generate recording path and ID
    const now = new Date();
    const timestamp = now.getTime();
    const objectKey = generateRecordingPath(uid, roomName, timestamp);
    const recordingId = firestore.collection("recordings").doc().id;
    const recordingRef = firestore.collection("recordings").doc(recordingId);

    // =========================================================================
    // STEP 1: Create Firestore doc IMMEDIATELY with status=starting
    // =========================================================================
    const initialDoc = {
      id: recordingId,
      userId: uid,
      roomName,
      layout: layout || "grid",
      status: "starting",
      downloadReady: false,
      objectKey,
      downloadPath: null,
      fileSize: null,
      egressId: null,
      errorMessage: null,
      livekitStatus: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      stoppedAt: null,
      readyAt: null,
      endedAt: null,
      duration: 0,
      viewerCount: 0,
      peakViewers: 0,
      paywallState: "none", // Future hook
      lastDownloadRequestedAt: null,
      downloadConfirmedAt: null,
      downloadIssueReportedAt: null,
      downloadIssueNote: null,
      oneTimeToken: null,
    };

    await recordingRef.set(initialDoc);
    console.log(`[recordings/start] Created doc ${recordingId} status=starting`);

    // =========================================================================
    // STEP 2: Start LiveKit egress to R2
    // =========================================================================
    let egressId: string | null = null;

    try {
      const { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } =
        await getLiveKitSdk();

      const egressClient = new EgressClient(
        livekitCfg.url!,
        livekitCfg.apiKey!,
        livekitCfg.apiSecret!
      );

      // =======================================================================
      // S3Upload Configuration for Cloudflare R2
      // 
      // COMMON 400 ERROR CAUSES:
      // 1. Wrong field names (accessKey vs accessKeyId)
      // 2. Missing region (must be "auto" for R2)
      // 3. Missing forcePathStyle: true
      // 4. Wrong endpoint format (must be https://<acct>.r2.cloudflarestorage.com)
      // 5. R2 API Token lacks "Edit" permission for bucket
      // 6. objectKey starts with "/" (should be "recordings/..." not "/recordings/...")
      // =======================================================================
      const s3UploadConfig = {
        bucket: r2Cfg.bucket,
        endpoint: r2Cfg.endpoint,
        region: "auto",                    // REQUIRED for R2 - not "us-east-1"
        accessKey: r2Cfg.accessKeyId,      // LiveKit SDK field name is "accessKey"
        secret: r2Cfg.secretAccessKey,     // LiveKit SDK field name is "secret"
        forcePathStyle: true,              // REQUIRED for R2
      };

      // Validate config before calling LiveKit
      const configErrors: string[] = [];
      if (!s3UploadConfig.bucket) configErrors.push("bucket is empty");
      if (!s3UploadConfig.endpoint) configErrors.push("endpoint is empty");
      if (!s3UploadConfig.accessKey) configErrors.push("accessKey is empty");
      if (!s3UploadConfig.secret) configErrors.push("secret is empty");
      if (!s3UploadConfig.endpoint?.includes(".r2.cloudflarestorage.com")) {
        configErrors.push(`endpoint format wrong: ${s3UploadConfig.endpoint}`);
      }
      if (objectKey.startsWith("/")) {
        configErrors.push(`objectKey has leading slash: ${objectKey}`);
      }

      if (configErrors.length > 0) {
        console.error("[recordings/start] ❌ S3 config errors:", configErrors);
        await recordingRef.update({
          status: "failed",
          errorMessage: `S3 config errors: ${configErrors.join(", ")}`,
          updatedAt: new Date(),
        });
        return res.status(500).json({
          success: false,
          error: "S3 configuration invalid",
          details: configErrors,
        });
      }

      // Log config (values hidden for secrets)
      console.log("[recordings/start] S3Upload config:", {
        bucket: s3UploadConfig.bucket,
        endpoint: s3UploadConfig.endpoint,
        region: s3UploadConfig.region,
        forcePathStyle: s3UploadConfig.forcePathStyle,
        accessKey: "✓ set",
        secret: "✓ set",
        objectKey: objectKey,
      });

      const s3Upload = new S3Upload(s3UploadConfig);

      // IMPORTANT: attach destination via oneof output { case: "s3", value }
      const fileOutput = new EncodedFileOutput({
        filepath: objectKey,
        fileType: EncodedFileType.MP4,
        output: { case: "s3", value: s3Upload },
      });

      // Store the EXACT objectKey we're telling egress to use
      // This must match what we HEAD check later
      console.log("[recordings/start] File output config:", {
        filepath: objectKey,
        fileType: "MP4",
        outputCase: (fileOutput as any)?.output?.case,
        fileOutputKeys: Object.keys(fileOutput || {}),
      });

      const compositeOpts = {
        // CRITICAL: Must be exactly "speaker" or "grid" - validated above
        layout: layout,
        audioOnly: false,
        videoOnly: false,
      };

      console.log("[recordings/start] Egress request:", {
        roomName,
        objectKey,
        layout: compositeOpts.layout,
      });

      // =======================================================================
      // EGRESS CALL - SDK 2.6.1 accepts direct EncodedFileOutput; ensure output.oneof is set
      // =======================================================================
      const egressResp = await egressClient.startRoomCompositeEgress(
        roomName,
        fileOutput,
        compositeOpts
      );

      egressId = (egressResp as any)?.egressId || null;

      if (!egressId) {
        throw new Error("No egressId returned from LiveKit");
      }

      console.log(`[recordings/start] Egress started: ${egressId}`);

    } catch (egressError: any) {
      // Egress failed - update doc to failed status
      console.error("[recordings/start] Egress start failed:", {
        message: egressError?.message,
        code: egressError?.code,
        details: egressError?.details,
        twirpMsg: egressError?.msg,
        twirpMeta: egressError?.meta,
        responseData: egressError?.response?.data,
        stack: egressError?.stack?.slice(0, 500),
      });

      await recordingRef.update({
        status: "failed",
        errorMessage: egressError?.message || "egress_start_failed",
        updatedAt: new Date(),
      });

      return res.status(500).json({
        success: false,
        error: "Failed to start recording",
        recordingId,
        details: egressError?.message,
      });
    }

    // =========================================================================
    // STEP 3: Update doc to status=recording with egressId
    // =========================================================================
    await recordingRef.update({
      egressId,
      status: "recording",
      livekitStatus: "EGRESS_STARTING",
      updatedAt: new Date(),
    });

    console.log(`[recordings/start] Complete in ${Date.now() - startTime}ms`);

    const finalSnap = await recordingRef.get();
    const finalData = finalSnap.data();

    return res.json({
      success: true,
      recordingId,
      egressId,
      recording: finalData,
    });

  } catch (err: any) {
    console.error("[recordings/start] Unexpected error:", err);
    return res.status(500).json({
      error: "Failed to start recording",
      details: err?.message,
    });
  }
});

// =============================================================================
// POST /stop - Stop Recording
// =============================================================================

router.post("/stop", requireAuth, async (req, res) => {
  console.log("[recordings/stop] Request received");

  try {
    const uid = getAuthUserId(req);
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { recordingId } = req.body as { recordingId?: string };
    if (!recordingId) {
      return res.status(400).json({ error: "recordingId is required" });
    }

    const recordingRef = firestore.collection("recordings").doc(recordingId);
    const snap = await recordingRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const data = snap.data() || {};

    // Verify ownership
    if (data.userId && data.userId !== uid) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Calculate duration
    const now = new Date();
    const startedAt: Date | null = data.startedAt?.toDate?.()
      ? data.startedAt.toDate()
      : data.startedAt || null;
    const durationSeconds = startedAt
      ? Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000))
      : 0;

    // =========================================================================
    // Stop LiveKit egress using stored egressId
    // =========================================================================
    const egressId = data.egressId;
    if (egressId) {
      try {
        const livekitCfg = getLiveKitConfig();
        if (livekitCfg.isConfigured) {
          const { EgressClient } = await getLiveKitSdk();
          const egressClient = new EgressClient(
            livekitCfg.url!,
            livekitCfg.apiKey!,
            livekitCfg.apiSecret!
          );
          await egressClient.stopEgress(egressId);
          console.log(`[recordings/stop] Stopped egress: ${egressId}`);
        }
      } catch (stopErr: any) {
        // Log but don't fail - egress might already be stopped
        console.warn("[recordings/stop] stopEgress warning:", stopErr?.message);
      }
    } else {
      console.warn("[recordings/stop] No egressId to stop for:", recordingId);
    }

    // =========================================================================
    // Update doc to status=processing
    // =========================================================================
    await recordingRef.update({
      status: "processing",
      stoppedAt: now,
      duration: durationSeconds,
      updatedAt: now,
      downloadReady: false,
      downloadPath: data.objectKey || null,
    });

    console.log(`[recordings/stop] Recording ${recordingId} now processing`);

    // Best-effort post-stop verification in case webhooks are delayed or dropped
    const objectKey = data.objectKey as string | undefined;
    if (objectKey) {
      setTimeout(async () => {
        try {
          const size = await r2HeadObjectSize(objectKey);
          if (size > 0) {
            await recordingRef.update({
              status: "ready",
              downloadReady: true,
              readyAt: new Date(),
              fileSize: size,
              updatedAt: new Date(),
            });
            console.log(`[recordings/stop] ✅ File confirmed via head-check: ${objectKey} (${size} bytes)`);
          } else {
            console.warn(`[recordings/stop] head-check found no file yet for ${objectKey}`);
          }
        } catch (checkErr: any) {
          console.warn(`[recordings/stop] head-check error for ${objectKey}:`, checkErr?.message);
        }
      }, 4000);
    }

    return res.json({ ok: true, success: true, recordingId });

  } catch (err: any) {
    console.error("[recordings/stop] Error:", err);
    return res.status(500).json({ error: "Failed to stop recording" });
  }
});

// =============================================================================
// GET /emergency-latest - Get latest ready recording for user
// Per spec: Query status=ready, order by createdAt desc, limit 1
// =============================================================================

router.get("/emergency-latest", requireAuth, async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    // Per spec: Query recordings where userId == uid AND status == "ready"
    // Order by createdAt descending, limit 1
    const snap = await firestore
      .collection("recordings")
      .where("userId", "==", uid)
      .where("status", "==", "ready")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      // Fallback: try to find any recording with an objectKey
      const fallbackSnap = await firestore
        .collection("recordings")
        .where("userId", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();

      let fallbackDoc: DocumentSnapshot | null = null;
      fallbackSnap.forEach((doc) => {
        if (!fallbackDoc) {
          const d = doc.data() || {};
          if (d.objectKey && d.paywallState !== "requires_payment") {
            fallbackDoc = doc;
          }
        }
      });

      if (!fallbackDoc) {
        return res.json({
          success: false,
          noRecording: true,
          message: "No ready recordings found",
        });
      }

      // Verify fallback file exists
      const fallbackData = fallbackDoc.data() || {};
      const size = await r2HeadObjectSize(fallbackData.objectKey);
      if (size <= 0) {
        return res.json({
          success: false,
          noRecording: true,
          message: "Recording file not found in storage",
        });
      }

      const signedUrl = await getSignedDownloadUrl(fallbackData.objectKey, 15 * 60);
      await firestore
        .collection("recordings")
        .doc(fallbackDoc.id)
        .set({ lastDownloadRequestedAt: Timestamp.now() }, { merge: true });

      return res.json({
        success: true,
        data: {
          url: signedUrl,
          recordingId: fallbackDoc.id,
          fallbackUsed: true,
          size,
          status: fallbackData.status,
        },
      });
    }

    // Found a ready recording
    const readyDoc = snap.docs[0];
    const readyData = readyDoc.data() || {};
    const objectKey = readyData.objectKey;

    if (!objectKey) {
      return res.json({
        success: false,
        noRecording: true,
        message: "Recording missing file reference",
      });
    }

    // Generate signed URL (15-minute TTL per spec)
    const signedUrl = await getSignedDownloadUrl(objectKey, 15 * 60);
    
    await firestore
      .collection("recordings")
      .doc(readyDoc.id)
      .set({ lastDownloadRequestedAt: Timestamp.now() }, { merge: true });

    return res.json({
      success: true,
      data: {
        url: signedUrl,
        recordingId: readyDoc.id,
        fallbackUsed: false,
      },
    });

  } catch (err: any) {
    console.error("[recordings/emergency-latest] Error:", err);
    return res.status(500).json({ error: "Failed to fetch latest recording" });
  }
});

// =============================================================================
// GET /:id/storage-check - Debug: verify object exists in R2
// =============================================================================

router.get("/:id/storage-check", requireAuth, async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    const recordingId = req.params.id;

    const snap = await firestore.collection("recordings").doc(recordingId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const data = snap.data() || {};
    if (data.userId && data.userId !== uid) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const objectKey = data.objectKey || data.downloadPath;
    if (!objectKey) {
      return res.json({ success: false, message: "No object key on recording" });
    }

    const size = await r2HeadObjectSize(objectKey);
    return res.json({ success: size > 0, size, objectKey });

  } catch (err: any) {
    console.error("[recordings/storage-check] Error:", err);
    return res.status(500).json({ error: "Failed to check storage" });
  }
});

// =============================================================================
// GET /:id - Get recording status
// =============================================================================

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    const recordingId = req.params.id;

    const snap = await firestore.collection("recordings").doc(recordingId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const data = snap.data() || {};
    if (data.userId && data.userId !== uid) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json({ success: true, data: mapRecordingDoc(recordingId, data) });

  } catch (err: any) {
    console.error("[recordings/:id] Error:", err);
    return res.status(500).json({ error: "Failed to fetch recording" });
  }
});

// =============================================================================
// GET /:id/download-link - Get signed download URL (only if status=ready)
// Per spec: 15-minute TTL, strict status === "ready" check
// =============================================================================

router.get("/:id/download-link", requireAuth, async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    const recordingId = req.params.id;

    const snap = await firestore.collection("recordings").doc(recordingId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const data = snap.data() || {};
    
    // Verify ownership
    if (data.userId && data.userId !== uid) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // STRICT CHECK: Only allow download if status is exactly "ready"
    // This ensures webhook has verified file exists in R2
    const status = String(data.status || "").toLowerCase();
    const downloadReady = data.downloadReady === true && status === "ready";

    if (!downloadReady) {
      return res.json({
        success: false,
        downloadReady: false,
        status: status,
        message: status === "failed" 
          ? `Recording failed: ${data.errorMessage || "Unknown error"}`
          : "Recording is still processing",
      });
    }

    // Check expiry
    const readyAt = data.readyAt || data.stoppedAt || null;
    if (isExpired(readyAt)) {
      return res.status(410).json({
        success: false,
        expired: true,
        message: "Recording link expired",
      });
    }

    // Paywall hook (MVP: always "none")
    if (data.paywallState === "requires_payment") {
      return res.status(402).json({
        success: false,
        paywall: true,
        message: "Upgrade required to download",
      });
    }

    const objectKey = data.objectKey || data.downloadPath;
    if (!objectKey) {
      return res.status(500).json({
        success: false,
        error: "Missing recording file reference",
      });
    }

    // Generate signed URL with 15-minute TTL per spec
    const DOWNLOAD_TTL_SECONDS = 15 * 60; // 15 minutes
    let signedUrl: string;
    try {
      signedUrl = await getSignedDownloadUrl(objectKey, DOWNLOAD_TTL_SECONDS);
    } catch (e: any) {
      console.error("[recordings/download-link] Signed URL error:", e);
      return res.status(500).json({
        success: false,
        error: "Download link unavailable. Try Emergency Download.",
      });
    }

    // Track download request
    const confirm = req.query.confirm === "true" || req.query.confirm === "1";
    const updates: any = { lastDownloadRequestedAt: Timestamp.now() };
    if (confirm) updates.downloadConfirmedAt = Timestamp.now();

    await firestore.collection("recordings").doc(recordingId).set(updates, { merge: true });

    return res.json({
      success: true,
      data: { 
        url: signedUrl, 
        downloadReady: true,
        expiresIn: DOWNLOAD_TTL_SECONDS,
      },
    });

  } catch (err: any) {
    console.error("[recordings/download-link] Error:", err);
    return res.status(500).json({ error: "Failed to generate download link" });
  }
});

// =============================================================================
// POST /:id/report-download-issue - Report download problems
// =============================================================================

router.post("/:id/report-download-issue", requireAuth, async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    const recordingId = req.params.id;

    const snap = await firestore.collection("recordings").doc(recordingId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const data = snap.data() || {};
    if (data.userId && data.userId !== uid) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await firestore.collection("recordings").doc(recordingId).set(
      {
        downloadIssueReportedAt: Timestamp.now(),
        downloadIssueNote: req.body?.reason || null,
        lastDownloadRequestedAt: Timestamp.now(),
      },
      { merge: true }
    );

    return res.json({ success: true });

  } catch (err: any) {
    console.error("[recordings/report-download-issue] Error:", err);
    return res.status(500).json({ error: "Failed to report issue" });
  }
});

// =============================================================================
// GET /:id/download - Legacy direct download (placeholder)
// =============================================================================

router.get("/:id/download", requireAuth, async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    const recordingId = req.params.id;

    const snap = await firestore.collection("recordings").doc(recordingId).get();
    if (!snap.exists) {
      return res.status(404).send("Recording not found");
    }

    const data = snap.data() || {};
    if (data.userId && data.userId !== uid) {
      return res.status(403).send("Forbidden");
    }

    // Redirect to download-link endpoint for proper signed URL
    res.redirect(`/api/recordings/${recordingId}/download-link`);

  } catch (err: any) {
    console.error("[recordings/download] Error:", err);
    return res.status(500).send("Failed to serve download");
  }
});

export default router;
