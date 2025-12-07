"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const livekit_server_sdk_1 = require("livekit-server-sdk");
const multistream_1 = __importDefault(require("./routes/multistream"));
const roomToken_1 = __importDefault(require("./routes/roomToken"));
const firebaseAdmin_1 = require("./firebaseAdmin");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const editing_1 = __importDefault(require("./routes/editing"));
const usageHelper_1 = require("./usageHelper");
const storageClient_1 = require("./lib/storageClient");
dotenv_1.default.config();
const PORT = process.env.PORT || 5137;
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve React static files
app.use(express_1.default.static(path_1.default.join(__dirname, "../dist")));
// Health check
app.get("/", (_req, res) => res.send("API up"));
// Token route used by the frontend
app.use("/api/roomToken", roomToken_1.default);
// Multistream routes (YouTube/FB)
app.use("/api/rooms", multistream_1.default);
app.use("/api/editing", editing_1.default);
// ✅ PROMPT #1: Storage test route
app.get("/api/storage/test", async (req, res) => {
    try {
        const testContent = `StreamLine Storage Test - ${new Date().toISOString()}`;
        const testBuffer = Buffer.from(testContent);
        const testPath = `test/${Date.now()}-test.txt`;
        const publicUrl = await (0, storageClient_1.uploadVideo)(testBuffer, testPath, "text/plain");
        res.json({
            success: true,
            message: "✅ R2 storage is working!",
            publicUrl,
            testPath,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("❌ Storage test failed:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Storage test failed",
        });
    }
});
// -------------------------------
// Admin Controls (Host/Mod Only)
// -------------------------------
const roomService = new livekit_server_sdk_1.RoomServiceClient(process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
// Mute/unmute a participant
// Admin: mute/unmute a single participant's audio
app.post("/api/admin/mute", async (req, res) => {
    try {
        const { room, identity, muted } = req.body;
        if (!room || !identity || typeof muted !== "boolean") {
            return res
                .status(400)
                .json({ error: "room, identity and muted are required" });
        }
        // Log for debugging
        console.log("ADMIN MUTE", { room, identity, muted });
        const participant = await roomService.getParticipant(room, identity);
        const audioTrack = participant.tracks?.find((t) => {
            const isAudioType = t.type === livekit_server_sdk_1.TrackType.AUDIO;
            const isMicSource = t.source === livekit_server_sdk_1.TrackSource.MICROPHONE;
            return isAudioType || isMicSource;
        });
        if (!audioTrack) {
            console.warn("No audio track found for", { room, identity });
            return res.status(404).json({ error: "no audio track found" });
        }
        await roomService.mutePublishedTrack(room, identity, audioTrack.sid, muted);
        return res.json({
            ok: true,
            muted,
            trackSid: audioTrack.sid,
            identity,
        });
    }
    catch (e) {
        console.error("mute error", e);
        const msg = typeof e?.message === "string"
            ? e.message
            : typeof e?.toString === "function"
                ? e.toString()
                : "mute_error";
        return res.status(500).json({ error: msg });
    }
});
// Admin: mute/unmute ALL participants' audio
// Admin: mute/unmute ALL participants' audio
app.post("/api/admin/mute-all", async (req, res) => {
    try {
        const { room, muted } = req.body;
        if (!room || typeof muted !== "boolean") {
            return res
                .status(400)
                .json({ error: "room and muted are required" });
        }
        console.log("ADMIN MUTE-ALL", { room, muted });
        const participants = await roomService.listParticipants(room);
        const results = [];
        for (const p of participants) {
            const audioTrack = p.tracks?.find((t) => {
                const isAudioType = t.type === livekit_server_sdk_1.TrackType.AUDIO;
                const isMicSource = t.source === livekit_server_sdk_1.TrackSource.MICROPHONE;
                return isAudioType || isMicSource;
            });
            if (!audioTrack) {
                results.push({
                    identity: p.identity,
                    trackSid: null,
                    changed: false,
                });
                continue;
            }
            await roomService.mutePublishedTrack(room, p.identity, audioTrack.sid, muted);
            results.push({
                identity: p.identity,
                trackSid: audioTrack.sid,
                changed: true,
            });
        }
        return res.json({ ok: true, muted, results });
    }
    catch (e) {
        console.error("mute-all error", e);
        const msg = typeof e?.message === "string"
            ? e.message
            : typeof e?.toString === "function"
                ? e.toString()
                : "mute_all_error";
        return res.status(500).json({ error: msg });
    }
});
// Remove/kick a participant
app.post("/api/admin/remove", async (req, res) => {
    try {
        const { room, identity } = req.body;
        await roomService.removeParticipant(room, identity);
        res.json({ ok: true });
    }
    catch (e) {
        console.error("remove error", e);
        res.status(500).json({ error: e.message || "remove_error" });
    }
});
// ---------- SIGNUP (with onboarding) ----------
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { email, password, displayName, timeZone, skipOnboarding, defaultResolution, defaultDestinations, defaultPrivacy, } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "email and password are required" });
        }
        // Check if user already exists
        const existingSnap = await firebaseAdmin_1.firestore
            .collection("users")
            .where("email", "==", email)
            .limit(1)
            .get();
        if (!existingSnap.empty) {
            return res.status(409).json({ error: "email already in use" });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const userData = {
            email,
            displayName: displayName || "",
            passwordHash,
            plan: "free",
            youtubeConnected: false,
            facebookConnected: false,
            createdAt: new Date().toISOString(),
            onboardingCompleted: !skipOnboarding,
        };
        if (timeZone) {
            userData.timeZone = timeZone;
        }
        // Only store streaming defaults if they didn't skip onboarding
        if (!skipOnboarding) {
            userData.defaultResolution = defaultResolution || "720p";
            userData.defaultDestinations = {
                youtube: defaultDestinations?.youtube ?? false,
                facebook: defaultDestinations?.facebook ?? false,
            };
            if (defaultPrivacy) {
                userData.defaultPrivacy = defaultPrivacy; // e.g. "public" | "unlisted"
            }
        }
        const userRef = await firebaseAdmin_1.firestore.collection("users").add(userData);
        await userRef.update({ id: userRef.id });
        const user = {
            id: userRef.id,
            email: userData.email,
            displayName: userData.displayName,
            plan: userData.plan,
            timeZone: userData.timeZone || null,
            onboardingCompleted: userData.onboardingCompleted,
            defaultResolution: userData.defaultResolution || null,
            defaultDestinations: userData.defaultDestinations || null,
            defaultPrivacy: userData.defaultPrivacy || null,
            youtubeConnected: userData.youtubeConnected,
            facebookConnected: userData.facebookConnected,
        };
        const token = jsonwebtoken_1.default.sign(user, JWT_SECRET, { expiresIn: "7d" });
        return res.json({ user, token });
    }
    catch (err) {
        console.error("signup error", err);
        return res.status(500).json({ error: "internal server error" });
    }
});
// ---------- LOGIN ----------
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "email and password are required" });
        }
        const snap = await firebaseAdmin_1.firestore
            .collection("users")
            .where("email", "==", email)
            .limit(1)
            .get();
        if (snap.empty) {
            return res.status(401).json({ error: "invalid email or password" });
        }
        const doc = snap.docs[0];
        const data = doc.data();
        const ok = await bcryptjs_1.default.compare(password, data.passwordHash || "");
        if (!ok) {
            return res.status(401).json({ error: "invalid email or password" });
        }
        const user = {
            id: doc.id,
            email: data.email,
            displayName: data.displayName || "",
            plan: data.plan || "free",
            timeZone: data.timeZone || null,
            onboardingCompleted: data.onboardingCompleted ?? false,
            defaultResolution: data.defaultResolution || null,
            defaultDestinations: data.defaultDestinations || null,
            defaultPrivacy: data.defaultPrivacy || null,
            youtubeConnected: data.youtubeConnected || false,
            facebookConnected: data.facebookConnected || false,
        };
        const token = jsonwebtoken_1.default.sign(user, JWT_SECRET, { expiresIn: "7d" });
        return res.json({ user, token });
    }
    catch (err) {
        console.error("login error", err);
        return res.status(500).json({ error: "internal server error" });
    }
});
app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});
app.get("/api/usage/summary", async (req, res) => {
    try {
        // TEMP: hardcode a test user id for now
        const uid = req.query.uid; // later you'll pull from auth
        if (!uid)
            return res.status(400).json({ error: "uid required" });
        const userRef = firebaseAdmin_1.firestore.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return res.status(404).json({ error: "user not found" });
        }
        const userData = userSnap.data() || {};
        const usage = (userData.usage || {});
        const planId = userData.plan || "free";
        // read plan doc
        const planSnap = await firebaseAdmin_1.firestore.collection("plans").doc(planId).get();
        const planData = planSnap.data() || {};
        const usedHours = usage.hoursStreamedThisMonth || 0;
        const maxHours = planData.maxHoursPerMonth || 0;
        const ytdHours = usage.ytdHours || 0;
        const resetDate = usage.resetDate || null;
        return res.json({
            displayName: userData.displayName || "",
            planId,
            usedHours,
            maxHours,
            ytdHours,
            resetDate,
            maxGuests: planData.maxGuests || 0,
            multistreamEnabled: !!planData.multistreamEnabled,
        });
    }
    catch (err) {
        console.error("usage summary error", err);
        return res.status(500).json({ error: "internal error" });
    }
});
// GET /api/usage/me - Get current user's usage (authenticated)
app.get("/api/usage/me", async (req, res) => {
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const userId = decoded.id;
        if (!userId) {
            return res.status(401).json({ error: "Invalid token" });
        }
        const usageData = await (0, usageHelper_1.getUserUsage)(userId);
        return res.json(usageData);
    }
    catch (err) {
        console.error("usage/me error", err);
        return res.status(500).json({ error: "internal error" });
    }
});
app.post("/api/usage/streamEnded", async (req, res) => {
    try {
        // TEMP: we'll pass uid from the client in the body
        const { uid, minutes = 0, guestCount = 0 } = req.body;
        if (!uid) {
            return res.status(400).json({ error: "uid required" });
        }
        const userRef = firebaseAdmin_1.firestore.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return res.status(404).json({ error: "user not found" });
        }
        const userData = userSnap.data() || {};
        const usage = (userData.usage || {});
        const now = new Date();
        // Use minutes from client (at least 1 minute)
        const durationMinutes = Math.max(1, minutes || 0);
        const durationHours = durationMinutes / 60;
        // --- handle monthly reset if needed ---
        const resetDate = usage.resetDate && usage.resetDate.toDate
            ? usage.resetDate.toDate()
            : null;
        if (resetDate && resetDate < now) {
            // new period starts now, reset monthly usage
            const nextReset = new Date();
            nextReset.setMonth(nextReset.getMonth() + 1);
            usage.hoursStreamedThisMonth = 0;
            usage.periodStart = now;
            usage.resetDate = nextReset;
            await userRef.update({
                "usage.hoursStreamedThisMonth": 0,
                "usage.periodStart": now,
                "usage.resetDate": nextReset,
            });
        }
        const hoursStreamedToday = (usage.hoursStreamedToday || 0) + durationHours;
        const hoursStreamedThisMonth = (usage.hoursStreamedThisMonth || 0) + durationHours;
        const ytdHours = (usage.ytdHours || 0) + durationHours;
        const guestCountToday = (usage.guestCountToday || 0) + guestCount;
        await userRef.update({
            "usage.hoursStreamedToday": hoursStreamedToday,
            "usage.hoursStreamedThisMonth": hoursStreamedThisMonth,
            "usage.ytdHours": ytdHours,
            "usage.guestCountToday": guestCountToday,
            "usage.lastUsageUpdate": now,
        });
        return res.json({
            ok: true,
            durationHours,
            hoursStreamedThisMonth,
            ytdHours,
        });
    }
    catch (err) {
        console.error("streamEnded error", err);
        return res.status(500).json({ error: "internal error" });
    }
});
// Serve React app for all routes that don't match /api
app.use((_req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../dist/index.html"));
});
app.listen(PORT, () => {
    console.log(`✅ Server listening on http://localhost:${PORT}`);
});
