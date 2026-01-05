"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const usagePlans_1 = require("../usagePlans");
const plan_1 = require("../types/plan");
const firebaseAdmin_1 = require("../firebaseAdmin");
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    try {
        const snap = await firebaseAdmin_1.firestore.collection("plans").get();
        const mapped = snap.docs.map((d) => {
            const data = d.data() || {};
            const features = (data.features || {});
            const limits = (data.limits || {});
            const id = d.id;
            // Determine visibility for public exposure
            // Defaults: 'public' unless explicitly hidden or admin-only; enterprise/internal default to admin
            const hidden = data.hidden === true;
            const visibility = 
            // Prefer explicit visibility; else respect legacy hidden flag; else default
            (data.visibility ?? (hidden ? "hidden" : ((id === "enterprise" || id === "internal") ? "admin" : "public")));
            const monthlyMinutesIncluded = Number(limits.monthlyMinutesIncluded ?? limits.participantMinutes ?? limits.monthlyMinutes ?? 0);
            const priceNumber = Number(data.priceMonthly ?? data.price ?? 0);
            // Determine if there is a valid Stripe price configured for paid plans
            let hasStripePrice = false;
            if ((0, plan_1.isPlanId)(id)) {
                if (id === "starter") {
                    hasStripePrice = !!process.env.STRIPE_PRICE_STARTER;
                }
                else if (id === "pro") {
                    hasStripePrice = !!process.env.STRIPE_PRICE_PRO;
                }
                else if (id === "basic") {
                    // Support canonical env var for 'basic' just like starter/pro
                    hasStripePrice = !!process.env.STRIPE_PRICE_BASIC;
                }
                else if (typeof data.stripePriceId === "string" && data.stripePriceId.trim().length > 0) {
                    hasStripePrice = true;
                }
            }
            else if (typeof data.stripePriceId === "string" && data.stripePriceId.trim().length > 0) {
                hasStripePrice = true;
            }
            const planObj = {
                id,
                name: data.name || id,
                price: priceNumber,
                description: data.description || "",
                visibility,
                // Expose a hint for admin clients (not used by public filtering; kept here for clarity)
                billable: id === "free" ? true : (priceNumber > 0 && hasStripePrice),
                limits: {
                    monthlyMinutesIncluded,
                    maxGuests: Number(limits.maxGuests ?? 0),
                    rtmpDestinationsMax: Number(limits.rtmpDestinationsMax ?? limits.maxDestinations ?? limits.rtmpDestinations ?? 0),
                    maxSessionMinutes: Number(limits.maxSessionMinutes ?? 0),
                    maxHoursPerMonth: Number(limits.maxHoursPerMonth ?? (monthlyMinutesIncluded > 0 ? Math.floor(monthlyMinutesIncluded / 60) : 0)),
                },
                features: {
                    recording: !!features.recording,
                    rtmp: !!features.rtmp,
                    multistream: !!(features.multistream ?? data.multistreamEnabled),
                },
                editing: {
                    access: !!data.editing?.access,
                    maxProjects: Number(data.editing?.maxProjects ?? 0),
                    maxStorageGB: (() => {
                        const fromGb = data.editing?.maxStorageGB;
                        const fromBytes = data.editing?.maxStorageBytes;
                        if (fromGb !== undefined && fromGb !== null)
                            return Number(fromGb);
                        if (fromBytes !== undefined && fromBytes !== null)
                            return Math.round(Number(fromBytes) / (1024 * 1024 * 1024));
                        return 0;
                    })(),
                },
            };
            return planObj;
        });
        // Filter to only publicly available and billable plans for this public endpoint
        const publicPlans = mapped.filter((p) => {
            if (p.visibility !== "public")
                return false;
            if (p.id === "free")
                return true;
            return p.price > 0 && p.billable === true;
        });
        // If no plan docs, fall back to ids
        if (!mapped.length)
            return res.json({ plans: usagePlans_1.PLANS });
        // If filter removed everything, fall back to mapped to avoid empty payloads
        const plansToReturn = publicPlans.length ? publicPlans : mapped;
        return res.json({ plans: plansToReturn });
    }
    catch (err) {
        console.error("/api/plans failed, returning fallback IDs:", err?.message || err);
        return res.json({ plans: usagePlans_1.PLANS });
    }
});
exports.default = router;
