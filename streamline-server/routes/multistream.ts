// server/routes/multistream.ts
import express from "express";
import type { EgressInfo } from "livekit-server-sdk";

import { firestore } from "../firebaseAdmin";
import { addUsageForUser } from "../usageHelper";
import { generateRecordingPath, getSignedDownloadUrl } from "../lib/storageClient";
import { getCurrentMonthKey, canStartStream } from "../lib/usageTracker";
import type { PlanDoc } from "../lib/usageTypes";

const router = express.Router();

// ---- LiveKit dynamic loader (runtime safe on Render) ----
type LiveKitSDK = typeof import("livekit-server-sdk");
type LiveKitEgressClient = import("livekit-server-sdk").EgressClient;

let _sdk: LiveKitSDK | null = null;
let _egressClient: LiveKitEgressClient | null = null;

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function getLiveKitSdk(): Promise<LiveKitSDK> {
  if (_sdk) return _sdk;
  _sdk = await import("livekit-server-sdk");
  return _sdk;
}

async function getEgressClient(): Promise<LiveKitEgressClient> {
  if (_egressClient) return _egressClient;

  const LIVEKIT_URL = mustGetEnv("LIVEKIT_URL");
  const LIVEKIT_API_KEY = mustGetEnv("LIVEKIT_API_KEY");
  const LIVEKIT_API_SECRET = mustGetEnv("LIVEKIT_API_SECRET");

  const { EgressClient } = await getLiveKitSdk();
  _egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  return _egressClient;
}

// Keep track of active egress + stream metadata per room
interface ActiveStream {
  egressId: string;
  userId: string;
  displayName?: string;
  roomName: string;
  startedAt: Date;
  guestCount?: number;
  planIdAtStart: "free" | "starter" | "pro";
  billingMonthKey: string;
  enforcement: {
    monthlyLimitMinutesAtStart: number;
    overagesEnabledAtStart: boolean;
    maxSessionMinutes: number;
  };
  flags: {
    recording: boolean;
    rtmpCount: number;
  };
  warningState: {
    warned80: boolean;
    warned90: boolean;
    graceStartedAt?: Date;
  };
}

const activeStreams = new Map<string, ActiveStream>();

// =============================================================================
// START MULTISTREAM
// =============================================================================

router.post("/:roomName/start-multistream", async (req, res) => {
  const { roomName } = req.params;

  const {
    youtubeStreamKey,
    facebookStreamKey,
    twitchStreamKey,
    userId,
    guestCount = 0,
  } = req.body as {
    youtubeStreamKey?: string;
    facebookStreamKey?: string;
    twitchStreamKey?: string;
    userId?: string;
    guestCount?: number;
  };

  console.log('🎬 Multistream request:', { 
    roomName, 
    userId, 
    hasYoutube: !!youtubeStreamKey, 
    hasFacebook: !!facebookStreamKey, 
    hasTwitch: !!twitchStreamKey 
  });

  if (!roomName) {
    return res.status(400).json({
      success: false,
      error: "roomName is required",
    });
  }

  // For MVP, userId is optional - use fallback if not provided
  const finalUserId = userId || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Build RTMP URLs for each platform
  const urls: string[] = [];

  if (youtubeStreamKey) {
    urls.push(`rtmp://a.rtmp.youtube.com/live2/${youtubeStreamKey}`);
    console.log("   ✅ YouTube URL added");
  }

  if (facebookStreamKey) {
    // Facebook requires RTMPS (secure) on port 443
    let cleanKey = facebookStreamKey;
    if (facebookStreamKey.includes("rtmps://") || facebookStreamKey.includes("rtmp://")) {
      const parts = facebookStreamKey.split("/");
      cleanKey = parts[parts.length - 1];
    }
    const fbUrl = `rtmps://live-api-s.facebook.com:443/rtmp/${cleanKey}`;
    console.log('   ✅ Facebook URL added');
    urls.push(fbUrl);
  }

  if (twitchStreamKey) {
    urls.push(`rtmp://live.twitch.tv/app/${twitchStreamKey}`);
    console.log("   ✅ Twitch URL added");
  }

  if (urls.length === 0) {
    return res.status(400).json({
      success: false,
      error: "At least one stream key (YouTube, Facebook, Twitch) is required",
    });
  }

  // =============================================================================
  // 🚦 USAGE GATE: Check if user can start stream
  // =============================================================================
  
  try {
    console.log("🚦 Checking usage limits for user:", finalUserId);

    // 1) Get user doc
    const userSnap = await firestore.collection("users").doc(finalUserId).get();
    if (!userSnap.exists) {
      console.warn("⚠️ User not found, allowing stream (guest mode)");
      // Allow guests to stream - they'll have no limits checked
    } else {
      const userData = userSnap.data() || {};
      const planId = String(userData.planId || userData.plan || "free");
      const overagesEnabled = !!userData.billing?.overagesEnabled || !!userData.overagesEnabled;

      console.log("📋 User plan:", planId, "| Overages:", overagesEnabled);

      // 2) Get plan doc
      const planSnap = await firestore.collection("plans").doc(planId).get();
      if (!planSnap.exists) {
        console.warn("⚠️ Plan not found, using free plan defaults");
        // Continue with free plan defaults
      } else {
        const plan = planSnap.data() as PlanDoc;

        // 3) Get usage doc for this month
        const monthKey = getCurrentMonthKey();
        const usageDocId = `${finalUserId}_${monthKey}`;
        const usageSnap = await firestore.collection("usageMonthly").doc(usageDocId).get();
        const usageData = usageSnap.exists ? (usageSnap.data() as any) : null;
        const currentUsage = {
          participantMinutes: Number(usageData?.totals?.participantMinutes || 0),
          transcodeMinutes: Number(usageData?.totals?.transcodeMinutes || 0),
        };

        console.log("📊 Current usage:", currentUsage);

        // 4) Intent: destinations + recording
        const selectedDestinationsCount = [youtubeStreamKey, facebookStreamKey, twitchStreamKey]
          .filter((v) => !!v && String(v).trim().length > 0).length;

        const wantsRTMP = selectedDestinationsCount > 0;
        const wantsRecording = false; // TODO: Add recording flag to request body

        console.log("🎯 Stream intent:", { destinations: selectedDestinationsCount, wantsRTMP, wantsRecording });

        // 5) Gate check
        const gateResult = canStartStream({
          uid: finalUserId,
          plan,
          userOverages: { overagesEnabled },
          selectedDestinationsCount,
          wantsRecording,
          wantsRTMP,
          currentUsage,
        });

        if (!gateResult.allowed) {
          console.log("🚫 Stream blocked:", gateResult.reason);
          return res.status(403).json({
            success: false,
            error: gateResult.reason,
            requiresUpgrade: gateResult.requiresUpgrade,
            requiresOveragesEnabled: gateResult.requiresOveragesEnabled,
          });
        }

        console.log("✅ Usage gate passed");
      }
    }
  } catch (err: any) {
    console.error("❌ Usage gate error:", err);
    // Don't block stream on gate errors - log and continue
    console.warn("⚠️ Continuing stream despite gate error");
  }

  // =============================================================================
  // 🎥 START EGRESS
  // =============================================================================

  try {
    console.log(`📡 Starting multistream for room: ${roomName}`);
    console.log(`   Streaming to ${urls.length} platform(s)`);

    // Create RTMP stream output + start Room Composite egress (CJS-safe)
    const { StreamOutput, StreamProtocol, EncodingOptionsPreset } = await getLiveKitSdk();

    const streamOutput = new StreamOutput({
      protocol: StreamProtocol.RTMP,
      urls,
    });

    // Get the client
    const egressClient = await getEgressClient();

    // Start Room Composite egress
    const info: EgressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      { stream: streamOutput },
      {
        layout: "grid",
        encodingOptions: EncodingOptionsPreset.H264_1080P_30,
      }
    );

    console.log("✅ Egress API call completed");

    // Extract egressId with fallbacks (LiveKit responses vary by version)
    const egressId =
      (info as any)?.egressId ??
      (info as any)?.info?.egressId ??
      (info as any)?.result?.egressId ??
      (info as any)?.data?.egressId;

    if (!egressId) {
      console.error("❌ No egressId in response!", info);
      return res.status(500).json({
        success: false,
        error: "LiveKit did not return an egressId",
      });
    }

    console.log("✅ Egress ID extracted:", egressId);

    // Track the active stream with metadata
    activeStreams.set(roomName, {
      egressId,
      userId: finalUserId,
      roomName,
      startedAt: new Date(),
      guestCount,
      planIdAtStart: "free",
      billingMonthKey: getCurrentMonthKey(),
      enforcement: {
        monthlyLimitMinutesAtStart: 0,
        overagesEnabledAtStart: false,
        maxSessionMinutes: 0,
      },
      flags: {
        recording: false,
        rtmpCount: urls.length,
      },
      warningState: {
        warned80: false,
        warned90: false,
      },
    });

    // Also store in Firestore for persistence
    await firestore.collection("activeStreams").doc(roomName).set(
      {
        egressId,
        userId: finalUserId,
        roomName,
        startedAt: new Date(),
        guestCount,
      },
      { merge: true }
    );

    console.log("✅ Stream tracked in memory and Firestore");

    return res.status(200).json({
      success: true,
      data: {
        egressId,
        status: (info as any)?.status || "started",
        roomName,
        outputs: {
          youtube: !!youtubeStreamKey,
          twitch: !!twitchStreamKey,
          facebook: !!facebookStreamKey,
        },
      },
    });

  } catch (err: any) {
    console.error("❌ Error starting multistream:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to start multistream",
      details: err?.message || String(err),
    });
  }
});

// =============================================================================
// STOP (preferred endpoint)
// =============================================================================
// -----------------------------------------------------------------------------
// STOP (new)
// -----------------------------------------------------------------------------
router.post("/stop", async (req, res) => {
  const { roomName, egressId } = req.body as { roomName?: string; egressId?: string };

  if (!roomName) {
    return res.status(400).json({ success: false, error: "roomName is required" });
  }

  // Grab metadata BEFORE we delete it
  const activeStream = activeStreams.get(roomName);

  const targetEgressId = egressId || activeStream?.egressId;
  if (!targetEgressId) {
    return res.status(400).json({
      success: false,
      error: "egressId is required or no active stream for this room",
    });
  }

  const now = new Date();

  let durationSeconds = 0;
  let durationMinutes = 0;
  let recordingId: string | null = null;
  let videoUrl: string | null = null;
  let recordingPath: string | null = null;

  try {
    console.log("🛑 Stopping egress:", targetEgressId);

    const egressClient = await getEgressClient();
    const stopResp = await egressClient.stopEgress(targetEgressId);

    console.log("✅ Egress stop requested:", (stopResp as any)?.egressId ?? targetEgressId);

    // Cleanup tracking (best-effort)
    activeStreams.delete(roomName);
    try {
      await firestore.collection("activeStreams").doc(roomName).delete();
    } catch (cleanupErr) {
      console.warn("⚠️ Failed to cleanup activeStreams doc:", cleanupErr);
    }

    // Post-stream tasks (only if we have metadata AND it's the same egress)
    if (activeStream && targetEgressId === activeStream.egressId) {
      const durationMs = now.getTime() - activeStream.startedAt.getTime();
      durationSeconds = Math.max(0, Math.floor(durationMs / 1000));
      durationMinutes = Math.max(0, Math.ceil(durationMs / 60000));

      console.log("⏱️ Duration:", durationMinutes, "minutes");

      // Usage tracking (best-effort)
      try {
        await addUsageForUser(activeStream.userId, durationMinutes, {
          guestCount: activeStream.guestCount,
          description: `Stream in room ${activeStream.roomName}`,
        });
        console.log("✅ Usage tracked");
      } catch (usageErr) {
        console.warn("⚠️ Failed to update usage:", usageErr);
      }

      // Recording URL (best-effort)
      try {
        const ts = Date.now();
        recordingPath = generateRecordingPath(activeStream.userId, activeStream.roomName, ts);
        videoUrl = await getSignedDownloadUrl(recordingPath);
        console.log("🎬 Recording path:", recordingPath);
      } catch (storageErr) {
        console.warn("⚠️ Failed to generate recording URL:", storageErr);
      }

      // Firestore recording doc (best-effort)
      try {
        const recordingRef = await firestore.collection("recordings").add({
          userId: activeStream.userId,
          roomName: activeStream.roomName,
          title: `Stream - ${new Date(activeStream.startedAt).toLocaleString()}`,
          status: "ready",
          duration: durationSeconds,
          durationMinutes,
          viewerCount: activeStream.guestCount || 0,
          peakViewers: activeStream.guestCount || 0,
          videoUrl,
          thumbnailUrl: null,
          storagePath: recordingPath,
          progress: 100,
          createdAt: activeStream.startedAt,
          updatedAt: now,
        });

        recordingId = recordingRef.id;
        console.log("✅ Created recording doc:", recordingId);
      } catch (firestoreErr) {
        console.warn("⚠️ Failed to create recording doc:", firestoreErr);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        egressId: targetEgressId,
        roomName,
        status: "stopped",
        durationSeconds,
        durationMinutes,
        recordingId,
        videoUrl,
        stoppedAt: now.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("❌ Error stopping multistream:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to stop multistream",
      details: err?.message || String(err),
    });
  }
});

// -----------------------------------------------------------------------------
// LEGACY STOP (backward compatibility)
// -----------------------------------------------------------------------------
router.post("/stop-multistream", async (req, res) => {
  const { egressId } = req.body as { egressId?: string };

  console.log("ℹ️ Legacy stop multistream:", { egressId });

  if (!egressId) {
    return res.status(400).json({ success: false, error: "egressId is required" });
  }

  try {
    const egressClient = await getEgressClient();
    const stopResp = await egressClient.stopEgress(egressId);

    // remove from tracking map (best-effort)
    for (const [roomName, stream] of activeStreams.entries()) {
      if (stream.egressId === egressId) {
        activeStreams.delete(roomName);
        try {
          await firestore.collection("activeStreams").doc(roomName).delete();
        } catch {}
        break;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        egressId: (stopResp as any)?.egressId ?? egressId,
        status: "stopped",
        stoppedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("❌ Legacy stop multistream failed:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to stop multistream",
      details: err?.message || String(err),
    });
  }
});

// -----------------------------------------------------------------------------
// STATUS (debug)
// -----------------------------------------------------------------------------
router.get("/status", (req, res) => {
  const streams = Array.from(activeStreams.entries()).map(([roomName, stream]) => ({
    roomName,
    egressId: stream.egressId,
    userId: stream.userId,
    startedAt: stream.startedAt.toISOString(),
    durationMinutes: Math.floor((Date.now() - stream.startedAt.getTime()) / 60000),
  }));

  return res.status(200).json({
    success: true,
    data: {
      activeStreams: streams,
      totalActive: streams.length,
    },
  });
});

export default router;