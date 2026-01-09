"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server/routes/usageRoutes.ts
const express_1 = __importDefault(require("express"));
const requireAuth_1 = require("../middleware/requireAuth");
const firestore_1 = require("firebase-admin/firestore");
const firebaseAdmin_1 = require("../firebaseAdmin");
const usageTracker_1 = require("../lib/usageTracker");
// Helper function to get the next reset date (start of next month)
function getNextResetDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}
const router = express_1.default.Router();
async function handleUsageSummary(req, res) {
    try {
        const uid = req.user?.uid;
        if (!uid) {
            return res.status(401).json({ success: false, error: "unauthorized" });
        }
        // 1) User doc (planId + overages setting)
        const userRef = firebaseAdmin_1.firestore.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return res.status(404).json({ success: false, error: "user not found" });
        }
        const userData = userSnap.data() || {};
        const planId = String(userData.planId || userData.plan || "free");
        const overagesEnabled = !!userData.overagesEnabled;
        // 2) Plan doc
        const planRef = firebaseAdmin_1.firestore.collection("plans").doc(planId);
        const planSnap = await planRef.get();
        if (!planSnap.exists) {
            return res.status(500).json({
                success: false,
                error: "plan not found",
                planId,
            });
        }
        const planData = planSnap.data() || {};
        const features = (planData.features || {});
        const limits = (planData.limits || {});
        // 3) Usage monthly doc (source of truth)
        const monthKey = (0, usageTracker_1.getCurrentMonthKey)();
        const usageDocId = `${uid}_${monthKey}`;
        const usageRef = firebaseAdmin_1.firestore.collection("usageMonthly").doc(usageDocId);
        const usageSnap = await usageRef.get();
        // If missing, do NOT fail—return a zeroed shape so the UI is stable.
        const legacyUsage = userData.usage || {};
        const legacyHours = Number(legacyUsage.hoursStreamedThisMonth || 0);
        const legacyParticipantMinutes = Math.max(0, Math.round(legacyHours * 60));
        let usageMonthly;
        if (usageSnap.exists) {
            usageMonthly = usageSnap.data();
        }
        else {
            usageMonthly = {
                uid,
                monthKey,
                usage: {
                    participantMinutes: legacyParticipantMinutes,
                    transcodeMinutes: 0,
                    minutes: {
                        live: {
                            currentPeriod: legacyParticipantMinutes,
                            lifetime: legacyParticipantMinutes,
                        },
                        recording: {
                            currentPeriod: 0,
                            lifetime: 0,
                        },
                    },
                },
                ytd: {
                    participantMinutes: Math.max(0, Math.round(Number(legacyUsage.ytdHours || 0) * 60)),
                    transcodeMinutes: 0,
                    minutes: {
                        live: {
                            lifetime: Math.max(0, Math.round(Number(legacyUsage.ytdHours || 0) * 60)),
                        },
                        recording: {
                            lifetime: 0,
                        },
                    },
                },
                createdAt: firestore_1.Timestamp.now(),
                updatedAt: firestore_1.Timestamp.now(),
            };
            // Persist seeded doc so subsequent calls don't lose legacy hours
            await usageRef.set(usageMonthly, { merge: true });
        }
        const toNumber = (value) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : 0;
        };
        const usage = usageMonthly.usage || {};
        const ytd = usageMonthly.ytd || {};
        const usageMinutes = usage.minutes || {};
        const ytdMinutes = ytd.minutes || {};
        const participantUsed = toNumber(usage.participantMinutes);
        const transcodeUsed = toNumber(usage.transcodeMinutes);
        const liveCurrent = toNumber(usageMinutes.live?.currentPeriod ?? participantUsed);
        const liveLifetime = toNumber(usageMinutes.live?.lifetime ?? ytdMinutes.live?.lifetime ?? ytd.participantMinutes);
        const recordingCurrent = toNumber(usageMinutes.recording?.currentPeriod);
        const recordingLifetime = toNumber(usageMinutes.recording?.lifetime ?? ytdMinutes.recording?.lifetime);
        const participantLimit = Number(limits.participantMinutes || 0); // 0 = unlimited
        const transcodeLimit = Number(limits.transcodeMinutes || 0); // 0 = unlimited
        const isOverParticipant = participantLimit > 0 ? participantUsed >= participantLimit : false;
        const isOverTranscode = transcodeLimit > 0 ? transcodeUsed >= transcodeLimit : false;
        const isOverLimit = isOverParticipant || isOverTranscode;
        const remainingParticipantMinutes = participantLimit > 0 ? Math.max(0, participantLimit - participantUsed) : null;
        const remainingTranscodeMinutes = transcodeLimit > 0 ? Math.max(0, transcodeLimit - transcodeUsed) : null;
        const resetDateISO = getNextResetDate().toISOString();
        return res.json({
            success: true,
            uid,
            monthKey,
            resetDate: resetDateISO,
            participantMinutes: participantUsed,
            transcodeMinutes: transcodeUsed,
            usage: {
                minutes: {
                    live: {
                        currentPeriod: liveCurrent,
                        lifetime: liveLifetime,
                    },
                    recording: {
                        currentPeriod: recordingCurrent,
                        lifetime: recordingLifetime,
                    },
                },
            },
            user: {
                planId,
                overagesEnabled,
                pendingPlan: userData.pendingPlan ?? null,
            },
            plan: {
                id: planId,
                name: planData.name || planId,
                priceMonthly: planData.priceMonthly ?? null,
                features: {
                    recording: !!features.recording,
                    rtmpMultistream: !!features.rtmpMultistream || !!features.rtmp || !!planData.multistreamEnabled,
                    overagesAllowed: !!features.overagesAllowed,
                },
                limits: {
                    maxDestinations: Number(limits.maxDestinations || 0),
                    participantMinutes: participantLimit,
                    transcodeMinutes: transcodeLimit,
                    maxGuests: Number(limits.maxGuests || (planId === "pro" ? 10 : planId === "starter" ? 2 : 1)),
                },
            },
            usageMonthly: {
                id: usageDocId,
                usage: {
                    participantMinutes: participantUsed,
                    transcodeMinutes: transcodeUsed,
                    participantHours: Math.round((participantUsed / 60) * 100) / 100,
                    transcodeHours: Math.round((transcodeUsed / 60) * 100) / 100,
                    minutes: {
                        live: {
                            currentPeriod: liveCurrent,
                            lifetime: liveLifetime,
                        },
                        recording: {
                            currentPeriod: recordingCurrent,
                            lifetime: recordingLifetime,
                        },
                    },
                },
                ytd: {
                    participantMinutes: Number(ytd.participantMinutes || 0),
                    transcodeMinutes: Number(ytd.transcodeMinutes || 0),
                    minutes: {
                        live: {
                            lifetime: toNumber(ytdMinutes.live?.lifetime ?? liveLifetime),
                        },
                        recording: {
                            lifetime: toNumber(ytdMinutes.recording?.lifetime ?? recordingLifetime),
                        },
                    },
                },
            },
            computed: {
                isOverLimit,
                isOverParticipant,
                isOverTranscode,
                remaining: {
                    participantMinutes: remainingParticipantMinutes, // null = unlimited
                    transcodeMinutes: remainingTranscodeMinutes, // null = unlimited
                },
            },
        });
    }
    catch (err) {
        console.error("❌ /api/usage/summary error:", err);
        return res.status(500).json({
            success: false,
            error: "internal_error",
            details: err?.message || String(err),
        });
    }
}
// Expose both endpoints with the same stable payload
router.get("/summary", requireAuth_1.requireAuth, handleUsageSummary);
router.get("/me", requireAuth_1.requireAuth, handleUsageSummary);
// Lightweight entitlements endpoint for client gating (features + limits)
router.get("/entitlements", requireAuth_1.requireAuth, async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        return res.status(401).json({ error: "unauthorized" });
    const userSnap = await firebaseAdmin_1.firestore.collection("users").doc(uid).get();
    if (!userSnap.exists)
        return res.status(404).json({ error: "user_not_found" });
    const planId = String((userSnap.data() || {}).planId || "free");
    const planSnap = await firebaseAdmin_1.firestore.collection("plans").doc(planId).get();
    if (!planSnap.exists)
        return res.status(404).json({ error: "plan_not_found", planId });
    const plan = planSnap.data() || {};
    const features = plan.features || {};
    const limits = plan.limits || {};
    return res.json({
        planId,
        planName: plan.name || planId,
        recording: !!features.recording,
        rtmpMultistream: !!features.rtmpMultistream || !!features.rtmp || !!plan.multistreamEnabled,
        dualRecording: !!features.dualRecording || !!features.dual_recording,
        watermark: !!features.watermarkRecordings || !!features.watermark,
        maxDestinations: Number(limits.maxDestinations || 0),
        maxGuests: Number(limits.maxGuests || 0),
        participantMinutes: Number(limits.participantMinutes || 0),
        transcodeMinutes: Number(limits.transcodeMinutes || 0),
    });
});
exports.default = router;
