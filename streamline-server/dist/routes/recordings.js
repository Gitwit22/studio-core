"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebaseAdmin_1 = require("../firebaseAdmin");
const requireAuth_1 = require("../middleware/requireAuth");
const featureAccess_1 = require("./featureAccess");
const firestore_1 = require("firebase-admin/firestore");
const storageClient_1 = require("../lib/storageClient");
const router = (0, express_1.Router)();
const DEFAULT_RETENTION_MINUTES = 30; // can be plan-tuned later
function computeExpiry(readyAt, retentionMinutes = DEFAULT_RETENTION_MINUTES) {
    if (!readyAt)
        return null;
    const readyDate = readyAt instanceof firestore_1.Timestamp ? readyAt.toDate() : readyAt;
    const expires = new Date(readyDate.getTime() + retentionMinutes * 60 * 1000);
    return expires;
}
function isExpired(readyAt, retentionMinutes) {
    const expires = computeExpiry(readyAt, retentionMinutes);
    return expires ? Date.now() >= expires.getTime() : false;
}
function mapRecordingDoc(id, data) {
    const status = data.status || "unknown";
    const downloadReady = !!(data.downloadReady || status === "ready" || status === "stopped");
    return {
        id,
        status,
        downloadReady,
        path: data.downloadPath || null,
        startedAt: data.startedAt || null,
        stoppedAt: data.stoppedAt || null,
        duration: data.duration || 0,
    };
}
router.post("/start", requireAuth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user?.uid || req.user?.id;
        if (!uid) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Feature access gate
        const access = await (0, featureAccess_1.canAccessFeature)(uid, "recording");
        if (!access.allowed) {
            return res.status(403).json({ success: false, error: access.reason || "Recording requires upgrade" });
        }
        // Load user
        const userSnap = await firebaseAdmin_1.firestore.collection("users").doc(uid).get();
        if (!userSnap.exists) {
            return res.status(401).json({ error: "User not found" });
        }
        const user = userSnap.data();
        const planId = user.planId || "free";
        // Load plan
        const planSnap = await firebaseAdmin_1.firestore.collection("plans").doc(planId).get();
        if (!planSnap.exists) {
            return res.status(403).json({ error: "Invalid plan" });
        }
        const plan = planSnap.data();
        // You can use plan data here in the future if recording tiers differ
        const { roomName, layout } = req.body;
        if (!roomName) {
            return res.status(400).json({ error: "roomName is required" });
        }
        const now = new Date();
        const recordingRef = firebaseAdmin_1.firestore.collection("recordings").doc();
        const recordingId = recordingRef.id;
        const recordingData = {
            id: recordingId,
            userId: uid,
            roomName,
            layout: layout || "grid",
            status: "recording",
            downloadReady: false,
            downloadPath: null,
            startedAt: now,
            stoppedAt: null,
            duration: 0,
            viewerCount: 0,
            peakViewers: 0,
            createdAt: now,
            updatedAt: now,
        };
        await recordingRef.set(recordingData);
        return res.json({
            success: true,
            recordingId,
            recording: recordingData,
        });
    }
    catch (err) {
        console.error("recording error:", err);
        return res.status(500).json({ error: "Failed to start recording" });
    }
});
router.post("/stop", requireAuth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user?.uid || req.user?.id;
        if (!uid) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { recordingId } = req.body;
        if (!recordingId) {
            return res.status(400).json({ error: "recordingId is required" });
        }
        const recordingRef = firebaseAdmin_1.firestore.collection("recordings").doc(recordingId);
        const snap = await recordingRef.get();
        if (!snap.exists) {
            return res.status(404).json({ error: "Recording not found" });
        }
        const data = snap.data() || {};
        if (data.userId && data.userId !== uid) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const now = new Date();
        const startedAt = data.startedAt?.toDate
            ? data.startedAt.toDate()
            : data.startedAt || null;
        const durationSeconds = startedAt ? Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000)) : 0;
        const readyAt = now;
        await recordingRef.update({
            status: "ready",
            stoppedAt: now,
            duration: durationSeconds,
            updatedAt: now,
            downloadReady: true,
            readyAt,
            downloadPath: data.downloadPath || data.objectKey || `/api/recordings/${recordingId}/download`,
        });
        return res.json({ ok: true });
    }
    catch (err) {
        console.error("recording stop error:", err);
        return res.status(500).json({ error: "Failed to stop recording" });
    }
});
// Emergency: fetch latest ready recording for this user (placed before /:id routes to avoid param catch)
router.get("/emergency-latest", requireAuth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user?.uid || req.user?.id;
        if (!uid)
            return res.status(401).json({ error: "Unauthorized" });
        const snap = await firebaseAdmin_1.firestore
            .collection("recordings")
            .where("userId", "==", uid)
            .orderBy("updatedAt", "desc")
            .limit(5)
            .get();
        let target = null;
        snap.forEach((doc) => {
            if (target)
                return;
            const d = doc.data() || {};
            const status = String(d.status || "").toLowerCase();
            const ready = !!(d.downloadReady || status === "ready" || status === "stopped");
            const expired = isExpired(d.readyAt || d.stoppedAt || null);
            const paywalled = d.paywallState === "requires_payment";
            if (ready && !expired && !paywalled)
                target = doc;
        });
        if (!target) {
            return res.json({ success: false, noRecording: true, message: "No ready recording available" });
        }
        const targetData = target.data() || {};
        const objectKey = targetData.objectKey || targetData.downloadPath;
        if (!objectKey) {
            return res.json({ success: false, noRecording: true, message: "Recording missing file reference" });
        }
        const signedUrl = await (0, storageClient_1.getSignedDownloadUrl)(objectKey, 300);
        await firebaseAdmin_1.firestore.collection("recordings").doc(target.id).set({ lastDownloadRequestedAt: firestore_1.Timestamp.now() }, { merge: true });
        return res.json({ success: true, data: { url: signedUrl, recordingId: target.id } });
    }
    catch (err) {
        console.error("emergency-latest error:", err);
        return res.status(500).json({ error: "Failed to fetch latest recording" });
    }
});
router.get("/:id", requireAuth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user?.uid || req.user?.id;
        const recordingId = req.params.id;
        const snap = await firebaseAdmin_1.firestore.collection("recordings").doc(recordingId).get();
        if (!snap.exists) {
            return res.status(404).json({ error: "Recording not found" });
        }
        const data = snap.data() || {};
        if (data.userId && data.userId !== uid) {
            return res.status(403).json({ error: "Forbidden" });
        }
        return res.json({ success: true, data: mapRecordingDoc(recordingId, data) });
    }
    catch (err) {
        console.error("recording get error:", err);
        return res.status(500).json({ error: "Failed to fetch recording" });
    }
});
router.get("/:id/download-link", requireAuth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user?.uid || req.user?.id;
        const recordingId = req.params.id;
        const snap = await firebaseAdmin_1.firestore.collection("recordings").doc(recordingId).get();
        if (!snap.exists) {
            return res.status(404).json({ error: "Recording not found" });
        }
        const data = snap.data() || {};
        if (data.userId && data.userId !== uid) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const status = String(data.status || "").toLowerCase();
        const downloadReady = !!(data.downloadReady || status === "ready" || status === "stopped");
        const readyAt = data.readyAt || data.stoppedAt || null;
        if (!downloadReady) {
            return res.json({ success: false, downloadReady: false, message: "Recording is still processing" });
        }
        if (isExpired(readyAt)) {
            return res.status(410).json({ success: false, expired: true, message: "Recording link expired" });
        }
        // Paywall hook: if paywallState is explicitly requires_payment, block
        if (data.paywallState === "requires_payment") {
            return res.status(402).json({ success: false, paywall: true, message: "Upgrade required to download" });
        }
        const confirm = req.query.confirm === "true" || req.query.confirm === "1";
        const objectKey = data.objectKey || data.downloadPath;
        if (!objectKey) {
            return res.status(500).json({ success: false, error: "Missing recording file reference" });
        }
        // Short-lived URL (5 minutes)
        const signedUrl = await (0, storageClient_1.getSignedDownloadUrl)(objectKey, 300);
        const updates = { lastDownloadRequestedAt: firestore_1.Timestamp.now() };
        if (confirm)
            updates.downloadConfirmedAt = firestore_1.Timestamp.now();
        await firebaseAdmin_1.firestore.collection("recordings").doc(recordingId).set(updates, { merge: true });
        return res.json({ success: true, data: { url: signedUrl, downloadReady: true } });
    }
    catch (err) {
        console.error("recording download-link error:", err);
        return res.status(500).json({ error: "Failed to generate download link" });
    }
});
// Report download issue for support signal
router.post("/:id/report-download-issue", requireAuth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user?.uid || req.user?.id;
        const recordingId = req.params.id;
        const snap = await firebaseAdmin_1.firestore.collection("recordings").doc(recordingId).get();
        if (!snap.exists) {
            return res.status(404).json({ error: "Recording not found" });
        }
        const data = snap.data() || {};
        if (data.userId && data.userId !== uid) {
            return res.status(403).json({ error: "Forbidden" });
        }
        await firebaseAdmin_1.firestore
            .collection("recordings")
            .doc(recordingId)
            .set({
            downloadIssueReportedAt: firestore_1.Timestamp.now(),
            downloadIssueNote: req.body?.reason || null,
            lastDownloadRequestedAt: firestore_1.Timestamp.now(),
        }, { merge: true });
        return res.json({ success: true });
    }
    catch (err) {
        console.error("report download issue error:", err);
        return res.status(500).json({ error: "Failed to report issue" });
    }
});
router.get("/:id/download", requireAuth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user?.uid || req.user?.id;
        const recordingId = req.params.id;
        const snap = await firebaseAdmin_1.firestore.collection("recordings").doc(recordingId).get();
        if (!snap.exists) {
            return res.status(404).send("Recording not found");
        }
        const data = snap.data() || {};
        if (data.userId && data.userId !== uid) {
            return res.status(403).send("Forbidden");
        }
        // Placeholder download content until real media storage is wired
        res.setHeader("Content-Type", "text/plain");
        return res.send(`Recording ${recordingId} download placeholder. Wire storage to serve media.`);
    }
    catch (err) {
        console.error("recording download error:", err);
        return res.status(500).send("Failed to serve download");
    }
});
exports.default = router;
