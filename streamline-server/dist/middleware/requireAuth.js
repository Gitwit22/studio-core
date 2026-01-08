"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryGetAuthUser = tryGetAuthUser;
exports.requireAuth = requireAuth;
exports.verifyInviteToken = verifyInviteToken;
exports.requireAuthOrInvite = requireAuthOrInvite;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function getJwtSecret() {
    return process.env.JWT_SECRET || "dev-secret";
}
function tryGetAuthUser(req) {
    const rawToken = req.cookies?.token ||
        req.headers.authorization?.replace("Bearer ", "");
    if (!rawToken)
        return null;
    const decoded = jsonwebtoken_1.default.verify(rawToken, getJwtSecret());
    return { uid: decoded.uid };
}
function requireAuth(req, res, next) {
    try {
        const user = tryGetAuthUser(req);
        if (!user)
            return res.status(401).json({ error: "Unauthorized" });
        req.user = user;
        return next();
    }
    catch (err) {
        console.error("[requireAuth] Unauthorized:", err?.message || err);
        return res.status(401).json({ error: "Unauthorized" });
    }
}
function verifyInviteToken(rawInviteToken) {
    const secret = process.env.INVITE_TOKEN_SECRET || getJwtSecret();
    if (!secret) {
        throw new Error("Invite token secret not configured");
    }
    const decoded = jsonwebtoken_1.default.verify(rawInviteToken, secret);
    return decoded;
}
function requireAuthOrInvite(req, res, next) {
    try {
        const user = tryGetAuthUser(req);
        if (user) {
            req.user = user;
            return next();
        }
    }
    catch (err) {
        // continue to invite token validation
        console.warn("[requireAuthOrInvite] Auth token invalid, checking invite token");
    }
    const inviteToken = req.headers["x-invite-token"] ||
        req.body?.inviteToken ||
        req.query?.inviteToken;
    if (!inviteToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const claims = verifyInviteToken(inviteToken);
        req.invite = claims;
        return next();
    }
    catch (err) {
        console.error("[requireAuthOrInvite] Invite token invalid:", err?.message || err);
        return res.status(401).json({ error: "Unauthorized" });
    }
}
