"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebaseAdmin_1 = require("../firebaseAdmin");
const requireAuth_1 = require("../middleware/requireAuth");
const featureAccess_1 = require("./featureAccess");
const router = (0, express_1.Router)();
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
exports.default = router;
