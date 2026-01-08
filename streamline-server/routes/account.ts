import { Router } from "express";
import { firestore } from "../firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { clampPresetForPlan, getPresetById, getUserPlanId, MEDIA_PRESETS, MediaPresetId } from "../lib/mediaPresets";

const router = Router();

const DEFAULT_MEDIA_PREFS = {
  defaultLayout: "speaker" as "speaker" | "grid",
  defaultRecordingMode: "cloud" as "cloud" | "dual",
  defaultPresetId: "standard_720p30" as MediaPresetId,
  warnOnHighQuality: true,
  destinationsDefaultMode: "last_used" as "last_used" | "pick_each_time",
  autoClamp: true,
};

function normalizeMediaPrefs(raw: any, planId: string) {
  const prefs = { ...DEFAULT_MEDIA_PREFS, ...(raw || {}) };
  const { preset } = clampPresetForPlan(planId, prefs.defaultPresetId);
  return {
    ...prefs,
    defaultPresetId: preset.id,
    autoClamp: true,
  };
}

router.use(requireAuth);

router.get("/me", async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ error: "unauthorized" });

    const snap = await firestore.collection("users").doc(uid).get();
    if (!snap.exists) return res.status(404).json({ error: "user_not_found" });

    const data = snap.data() || {};
    const planId = await getUserPlanId(uid);
    const mediaPrefs = normalizeMediaPrefs(data.mediaPrefs, planId);

    return res.json({
      id: uid,
      email: data.email || null,
      displayName: data.displayName || null,
      planId,
      mediaPrefs,
    });
  } catch (err: any) {
    console.error("[account/me] error", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.get("/presets", (_req, res) => {
  return res.json({ presets: MEDIA_PRESETS });
});

router.patch("/media-prefs", async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ error: "unauthorized" });

    const planId = await getUserPlanId(uid);
    const body = req.body || {};
    const updates: any = {};

    if (body.defaultLayout === "speaker" || body.defaultLayout === "grid") {
      updates.defaultLayout = body.defaultLayout;
    }
    if (body.defaultRecordingMode === "cloud" || body.defaultRecordingMode === "dual") {
      updates.defaultRecordingMode = body.defaultRecordingMode;
    }
    if (typeof body.warnOnHighQuality === "boolean") {
      updates.warnOnHighQuality = body.warnOnHighQuality;
    }
    if (body.destinationsDefaultMode === "last_used" || body.destinationsDefaultMode === "pick_each_time") {
      updates.destinationsDefaultMode = body.destinationsDefaultMode;
    }
    if (body.defaultPresetId) {
      const preset = getPresetById(String(body.defaultPresetId));
      const { preset: effective, clamped } = clampPresetForPlan(planId, preset.id);
      updates.defaultPresetId = clamped ? effective.id : preset.id;
    }

    const merged = { ...DEFAULT_MEDIA_PREFS, ...updates, autoClamp: true };
    await firestore.collection("users").doc(uid).set({ mediaPrefs: merged }, { merge: true });

    return res.json({ mediaPrefs: merged });
  } catch (err: any) {
    console.error("[account/media-prefs] error", err);
    return res.status(500).json({ error: "failed_to_update_media_prefs" });
  }
});

export default router;
