"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server/routes/multistream.ts
const express_1 = __importDefault(require("express"));
const livekitClient_1 = require("../livekitClient");
const livekit_server_sdk_1 = require("livekit-server-sdk");
const firebaseAdmin_1 = require("../firebaseAdmin");
const usageHelper_1 = require("../usageHelper");
const storageClient_1 = require("../lib/storageClient");
const router = express_1.default.Router();
const activeStreams = new Map();
router.post("/:roomName/start-multistream", async (req, res) => {
    const { roomName } = req.params;
    const { youtubeStreamKey, facebookStreamKey, twitchStreamKey, userId, // Pass userId from frontend
    guestCount = 0, } = req.body;
    if (!roomName) {
        return res.status(400).json({ error: "roomName is required" });
    }
    if (!userId) {
        return res.status(400).json({ error: "userId is required" });
    }
    // Build RTMP URLs for each platform
    const urls = [];
    if (youtubeStreamKey) {
        urls.push(`rtmp://a.rtmp.youtube.com/live2/${youtubeStreamKey}`);
    }
    if (facebookStreamKey) {
        urls.push(`rtmps://live-api-s.facebook.com:443/rtmp/${facebookStreamKey}`);
    }
    if (twitchStreamKey) {
        urls.push(`rtmp://live.twitch.tv/app/${twitchStreamKey}`);
    }
    if (urls.length === 0) {
        return res
            .status(400)
            .json({ error: "At least one stream key (YouTube, Facebook, Twitch) is required" });
    }
    try {
        const streamOutput = new livekit_server_sdk_1.StreamOutput({
            protocol: livekit_server_sdk_1.StreamProtocol.RTMP,
            urls,
        });
        // Start Room Composite egress and stream to all URLs
        const info = await livekitClient_1.egressClient.startRoomCompositeEgress(roomName, { stream: streamOutput }, { layout: "grid" });
        // Track the active stream with metadata
        if (info.egressId) {
            activeStreams.set(roomName, {
                egressId: info.egressId,
                userId,
                roomName,
                startedAt: new Date(),
                guestCount,
            });
            // Also store in Firestore for persistence (optional, for webhooks later)
            await firebaseAdmin_1.firestore.collection("activeStreams").doc(roomName).set({
                egressId: info.egressId,
                userId,
                roomName,
                startedAt: new Date(),
                guestCount,
            }, { merge: true });
        }
        return res.json({
            success: true,
            egressId: info.egressId,
            urls,
        });
    }
    catch (err) {
        console.error("Error starting multistream", err);
        return res.status(500).json({
            error: "Failed to start multistream",
            details: err?.message,
        });
    }
});
router.post("/:roomName/stop-multistream", async (req, res) => {
    const { roomName } = req.params;
    if (!roomName) {
        return res.status(400).json({ error: "roomName is required" });
    }
    const activeStream = activeStreams.get(roomName);
    if (!activeStream) {
        return res.status(404).json({
            error: "No active multistream found for this room",
        });
    }
    try {
        // Stop the egress
        await livekitClient_1.egressClient.stopEgress(activeStream.egressId);
        // Calculate stream duration
        const now = new Date();
        const durationMs = now.getTime() - activeStream.startedAt.getTime();
        const durationMinutes = Math.ceil(durationMs / 60000); // Round up to nearest minute
        // Add usage for this stream
        const usageResult = await (0, usageHelper_1.addUsageForUser)(activeStream.userId, durationMinutes, {
            guestCount: activeStream.guestCount,
            description: `Stream in room ${activeStream.roomName}`,
        });
        // ✅ PROMPT #2: Create recording document after stream ends
        const timestamp = Date.now();
        const recordingPath = (0, storageClient_1.generateRecordingPath)(activeStream.userId, activeStream.roomName, timestamp);
        // Create recording doc in Firestore
        const recordingRef = await firebaseAdmin_1.firestore.collection("recordings").add({
            userId: activeStream.userId,
            roomId: activeStream.roomName,
            title: `Stream - ${new Date(activeStream.startedAt).toLocaleString()}`,
            createdAt: activeStream.startedAt,
            durationMinutes,
            storagePath: recordingPath,
            status: "processing",
            planId: "free",
            guestCount: activeStream.guestCount || 0,
            editConfig: null,
            renderedPath: null,
            uploadedToUrls: {},
            updatedAt: now,
        });
        console.log(`✅ Created recording doc: ${recordingRef.id}`);
        // Clean up tracking
        activeStreams.delete(activeStream.roomName);
        await firebaseAdmin_1.firestore.collection("activeStreams").doc(activeStream.roomName).delete();
        return res.json({
            success: true,
            durationMinutes,
            recordingId: recordingRef.id,
            recordingPath,
            usageUpdated: usageResult,
        });
    }
    catch (err) {
        console.error("Error stopping multistream", err);
        return res.status(500).json({
            error: "Failed to stop multistream",
            details: err?.message,
        });
    }
});
exports.default = router;
