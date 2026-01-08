"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const requireAuth_1 = require("../middleware/requireAuth");
const firebaseAdmin_1 = require("../firebaseAdmin");
// Dynamic import for AccessToken constructor
async function getAccessTokenCtor() {
    const mod = await import("livekit-server-sdk");
    return mod.AccessToken;
}
async function getRoomServiceClient() {
    const mod = await import("livekit-server-sdk");
    return mod.RoomServiceClient;
}
function deriveServiceUrl() {
    const raw = process.env.LIVEKIT_URL || "";
    if (!raw)
        return null;
    // Convert wss://host to https://host for RoomServiceClient
    return raw.replace(/^wss?:\/\//i, (m) => (m.toLowerCase() === "ws://" ? "http://" : "https://"));
}
function roleToGrant(role) {
    const base = {
        roomJoin: true,
        canSubscribe: true,
    };
    if (role === "viewer") {
        return { ...base, canPublish: false, canPublishData: false, canUpdateMetadata: false, roomAdmin: false };
    }
    if (role === "moderator") {
        return { ...base, canPublish: true, canPublishData: true, canUpdateMetadata: true, roomAdmin: true };
    }
    // participant/host/cohost
    return { ...base, canPublish: true, canPublishData: true, canUpdateMetadata: false, roomAdmin: false };
}
async function getPlanLimit(uid, field) {
    const userSnap = await firebaseAdmin_1.firestore.collection("users").doc(uid).get();
    const planId = String((userSnap.data() || {}).planId || "free");
    const planSnap = await firebaseAdmin_1.firestore.collection("plans").doc(planId).get();
    if (!planSnap.exists)
        return undefined;
    const limits = (planSnap.data() || {}).limits || {};
    const raw = limits[field];
    if (raw === undefined || raw === null)
        return undefined;
    const num = Number(raw);
    return Number.isFinite(num) ? num : undefined;
}
async function getParticipantCount(roomName) {
    const serviceUrl = deriveServiceUrl();
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!serviceUrl || !apiKey || !apiSecret)
        return null;
    try {
        const RoomServiceClient = await getRoomServiceClient();
        const client = new RoomServiceClient(serviceUrl, apiKey, apiSecret);
        const participants = await client.listParticipants(roomName);
        return participants?.length ?? 0;
    }
    catch (err) {
        console.warn("[roomToken] participant count failed", err?.message || err);
        return null;
    }
}
const router = (0, express_1.Router)();
router.post("/", requireAuth_1.requireAuthOrInvite, async (req, res) => {
    try {
        const { roomName, identity, role: rawRole } = req.body;
        const uid = req.user?.uid;
        const invite = req.invite;
        if (!uid && !invite)
            return res.status(401).json({ error: "Unauthorized" });
        if (!roomName || !roomName.trim())
            return res.status(400).json({ error: "roomName is required" });
        if (invite) {
            const inviteRoom = invite.roomName || invite.room;
            if (!inviteRoom)
                return res.status(400).json({ error: "invite_token_missing_room" });
            if (inviteRoom !== roomName)
                return res.status(403).json({ error: "invite_room_mismatch" });
        }
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        if (!apiKey || !apiSecret) {
            return res.status(500).json({ error: "LiveKit keys missing in env" });
        }
        const AccessToken = await getAccessTokenCtor();
        const inviteIdentity = invite?.identity || invite?.uid || invite?.sub || null;
        const tokenIdentity = (identity && identity.trim()) || uid || inviteIdentity || `invite-${roomName}`; // prefer provided identity, fallback to auth/ invite
        const requestedRole = String(rawRole || "participant").toLowerCase();
        const allowedRoles = ["host", "participant", "moderator", "viewer", "cohost"];
        const normalizedRole = (allowedRoles.includes(requestedRole) ? requestedRole : "participant");
        const wantsModerator = normalizedRole === "moderator";
        const isRoomAdmin = req.body?.roomAdmin === true || req.body?.isRoomAdmin === true;
        const finalRole = wantsModerator && !isRoomAdmin
            ? "participant"
            : normalizedRole === "cohost"
                ? "participant"
                : normalizedRole;
        const isViewer = finalRole === "viewer";
        const at = new AccessToken(apiKey, apiSecret, { identity: tokenIdentity });
        at.addGrant({
            room: roomName,
            ...roleToGrant(finalRole),
        });
        const jwt = await at.toJwt();
        console.log("✅ roomToken jwt typeof:", typeof jwt, "len:", jwt.length);
        const serverUrl = process.env.LIVEKIT_URL || null;
        return res.status(200).json({ token: jwt, serverUrl, role: finalRole, isViewer });
    }
    catch (err) {
        console.error("roomToken error:", err);
        return res.status(500).json({ error: "Failed to create room token" });
    }
});
// Public guest token: subscribe only (downgraded to viewer when over cap)
router.post("/guest", async (req, res) => {
    try {
        const { roomName, displayName, guestId, inviteToken } = req.body;
        if (!roomName || !roomName.trim())
            return res.status(400).json({ error: "roomName is required" });
        if (!displayName || !displayName.trim())
            return res.status(400).json({ error: "displayName is required" });
        if (inviteToken) {
            try {
                const claims = (0, requireAuth_1.verifyInviteToken)(inviteToken);
                const inviteRoom = claims.roomName || claims.room;
                if (inviteRoom && inviteRoom !== roomName) {
                    return res.status(403).json({ error: "invite_room_mismatch" });
                }
            }
            catch (err) {
                console.error("guest invite verify failed", err?.message || err);
                return res.status(401).json({ error: "invalid_invite" });
            }
        }
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        if (!apiKey || !apiSecret) {
            return res.status(500).json({ error: "LiveKit keys missing in env" });
        }
        // Guest cap check (plan-aware via host, fallback to env)
        let inviteClaims;
        if (inviteToken) {
            try {
                inviteClaims = (0, requireAuth_1.verifyInviteToken)(inviteToken);
            }
            catch (err) {
                console.error("guest invite verify failed", err?.message || err);
                return res.status(401).json({ error: "invalid_invite" });
            }
        }
        const hostUid = inviteClaims?.uid || inviteClaims?.sub || req.body?.hostUid;
        const maxGuestsPlan = hostUid ? await getPlanLimit(hostUid, "maxGuests") : undefined;
        const maxGuestsEnv = Number(process.env.MAX_GUESTS_PER_ROOM || "0");
        const envCap = Number.isFinite(maxGuestsEnv) && maxGuestsEnv > 0 ? maxGuestsEnv : undefined;
        const maxGuests = maxGuestsPlan !== undefined ? maxGuestsPlan : envCap;
        let overCap = false;
        if (maxGuests !== undefined) {
            const participantCount = await getParticipantCount(roomName);
            if (participantCount !== null && participantCount >= maxGuests) {
                overCap = true;
            }
        }
        const identity = (guestId && guestId.trim()) || crypto_1.default.randomUUID();
        const AccessToken = await getAccessTokenCtor();
        const at = new AccessToken(apiKey, apiSecret, { identity });
        const role = overCap ? "viewer" : "participant";
        at.addGrant({
            room: roomName,
            ...roleToGrant(role),
        });
        const jwt = await at.toJwt();
        const serverUrl = process.env.LIVEKIT_URL || null;
        return res.status(200).json({ token: jwt, serverUrl, identity, role, isViewer: role === "viewer" });
    }
    catch (err) {
        console.error("roomToken guest error:", err);
        return res.status(500).json({ error: "Failed to create guest token" });
    }
});
exports.default = router;
