"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebaseAdmin_1 = require("../firebaseAdmin");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const storageClient_1 = require("../lib/storageClient");
const usageHelper_1 = require("../usageHelper");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
// Middleware to verify JWT and extract user info
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = { id: decoded.id, planId: decoded.plan };
        next();
    }
    catch (err) {
        return res.status(403).json({ error: "Invalid token" });
    }
};
// POST /api/editing/upload - For uploading new clips (future use)
router.post("/upload", authenticateToken, async (req, res) => {
    try {
        const { title, description, fileBuffer, fileSizeBytes } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // ✅ PROMPT #3: Check storage limits before upload
        if (fileSizeBytes) {
            await (0, usageHelper_1.checkStorageLimit)(userId, fileSizeBytes);
        }
        // Upload file to R2
        if (fileBuffer) {
            const buffer = Buffer.from(fileBuffer);
            const path = `uploads/${userId}/${Date.now()}-${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
            const publicUrl = await (0, storageClient_1.uploadVideo)(buffer, path, "video/mp4");
            // Update storage usage
            await (0, usageHelper_1.updateStorageUsage)(userId, buffer.byteLength);
            res.json({
                ok: true,
                message: "File uploaded successfully",
                publicUrl,
                storagePath: path,
            });
        }
        else {
            res.json({ ok: true, message: "Upload endpoint ready" });
        }
    }
    catch (err) {
        console.error("upload error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});
// GET /api/editing/list - Get all recordings for the authenticated user
router.get("/list", async (req, res) => {
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1];
        let userId = null;
        // If token provided, use it; otherwise fetch all recordings for testing
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                userId = decoded.id;
            }
            catch (err) {
                // Invalid token, will fetch all recordings
                userId = null;
            }
        }
        let query = firebaseAdmin_1.firestore.collection("recordings");
        // If we have a valid user ID, filter by it
        if (userId) {
            query = query.where("userId", "==", userId);
        }
        const recordingsSnap = await query.get();
        const recordings = recordingsSnap.docs
            .map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }))
            .sort((a, b) => {
            // Sort by createdAt descending in memory
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
        });
        res.json(recordings);
    }
    catch (err) {
        console.error("list error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
// POST /api/editing/save - Save edit configuration for a recording
router.post("/save", authenticateToken, async (req, res) => {
    try {
        const { recordingId, editConfig } = req.body;
        const userId = req.user?.id;
        if (!userId || !recordingId) {
            return res.status(400).json({ error: "recordingId is required" });
        }
        // Verify ownership
        const recordingSnap = await firebaseAdmin_1.firestore.collection("recordings").doc(recordingId).get();
        if (!recordingSnap.exists) {
            return res.status(404).json({ error: "Recording not found" });
        }
        const recordingData = recordingSnap.data();
        if (recordingData.userId !== userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        // Save edit config
        await firebaseAdmin_1.firestore.collection("recordings").doc(recordingId).update({
            editConfig,
            updatedAt: new Date(),
        });
        res.json({ ok: true, message: "Edit config saved" });
    }
    catch (err) {
        console.error("save error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
// POST /api/editing/render - Trigger render job for a recording
router.post("/render", authenticateToken, async (req, res) => {
    try {
        const { recordingId, renderedBuffer } = req.body;
        const userId = req.user?.id;
        if (!userId || !recordingId) {
            return res.status(400).json({ error: "recordingId is required" });
        }
        // Verify ownership
        const recordingSnap = await firebaseAdmin_1.firestore.collection("recordings").doc(recordingId).get();
        if (!recordingSnap.exists) {
            return res.status(404).json({ error: "Recording not found" });
        }
        const recordingData = recordingSnap.data();
        if (recordingData.userId !== userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        // Update recording status to "rendering"
        await firebaseAdmin_1.firestore.collection("recordings").doc(recordingId).update({
            status: "rendering",
            renderStartedAt: new Date(),
        });
        // ✅ PROMPT #4: When export finishes, upload rendered video to R2
        if (renderedBuffer) {
            try {
                const buffer = Buffer.from(renderedBuffer);
                // Check storage limit
                await (0, usageHelper_1.checkStorageLimit)(userId, buffer.byteLength);
                // Upload to R2
                const exportPath = `exports/${userId}/${recordingId}/${Date.now()}.mp4`;
                const publicUrl = await (0, storageClient_1.uploadVideo)(buffer, exportPath, "video/mp4");
                // Update storage usage
                await (0, usageHelper_1.updateStorageUsage)(userId, buffer.byteLength);
                // Update recording with rendered path and URL
                await firebaseAdmin_1.firestore.collection("recordings").doc(recordingId).update({
                    status: "complete",
                    renderedPath: exportPath,
                    publicExportUrl: publicUrl,
                    renderedAt: new Date(),
                });
                return res.json({
                    status: "complete",
                    recordingId,
                    message: "Render and export completed",
                    publicUrl,
                    exportPath,
                });
            }
            catch (uploadErr) {
                console.error("Export upload failed:", uploadErr);
                await firebaseAdmin_1.firestore.collection("recordings").doc(recordingId).update({
                    status: "render_failed",
                    error: uploadErr.message,
                });
                return res.status(500).json({
                    error: "Failed to upload rendered video",
                    details: uploadErr.message,
                });
            }
        }
        res.json({
            status: "queued",
            recordingId,
            message: "Render job queued",
        });
    }
    catch (err) {
        console.error("render error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});
// POST /api/editing/create-recording - Create a new recording document when stream starts
router.post("/create-recording", authenticateToken, async (req, res) => {
    try {
        const { roomName, title, viewerCount, peakViewers } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (!title) {
            return res.status(400).json({ error: "Title is required" });
        }
        // Create new recording document
        const recordingRef = firebaseAdmin_1.firestore.collection("recordings").doc();
        const recordingData = {
            id: recordingRef.id,
            userId,
            roomName: roomName || "default-room",
            title,
            status: "ready",
            duration: 0,
            viewerCount: viewerCount || 0,
            peakViewers: peakViewers || 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            videoUrl: null,
            thumbnailUrl: null,
            progress: 100,
        };
        await recordingRef.set(recordingData);
        console.log("✅ Recording created:", recordingData);
        res.json({
            ok: true,
            id: recordingRef.id,
            status: "ready",
            message: "Recording created successfully",
            recording: recordingData,
        });
    }
    catch (err) {
        console.error("❌ create-recording error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});
exports.default = router;
