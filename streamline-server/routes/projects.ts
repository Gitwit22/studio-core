/**
 * Projects API — Core media-workspace routes
 *
 * These are NOT editing-specific. Projects exist whether editing is on or off.
 * Every paid-tier user gets a project workspace. Free users get read-only
 * access to auto-created recording projects.
 *
 * Routes:
 *   GET    /api/projects           — List user's projects
 *   POST   /api/projects           — Create a project
 *   GET    /api/projects/:id       — Get single project
 *   PATCH  /api/projects/:id       — Update project name/status
 *   DELETE /api/projects/:id       — Archive project
 *   GET    /api/projects/:id/assets — List project assets
 *   GET    /api/projects/:id/assets/:assetId/download — Download asset
 *   DELETE /api/projects/:id/assets/:assetId — Remove asset
 */

import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth";
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  listProjectAssets,
  getProjectAsset,
  deleteProjectAsset,
  addAssetToProject,
  serializeProject,
  serializeAsset,
} from "../lib/projectManager";
import { getSignedDownloadUrl, uploadVideo } from "../lib/storageClient";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

function getAuthUserId(req: any): string | null {
  return req.user?.uid || req.authUid || null;
}

// ── GET / — list projects ────────────────────────────────────────────────────
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const projects = await listProjects(uid, limit);
    return res.json({ projects: projects.map(serializeProject) });
  } catch (err: any) {
    console.error("[projects] list error:", err?.message || err);
    return res.status(500).json({ error: "Failed to list projects" });
  }
});

// ── POST / — create project ─────────────────────────────────────────────────
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "Project name is required" });

    const project = await createProject({
      ownerId: uid,
      name,
      createdBy: uid,
    });
    return res.status(201).json({ project: serializeProject(project) });
  } catch (err: any) {
    console.error("[projects] create error:", err?.message || err);
    return res.status(500).json({ error: "Failed to create project" });
  }
});

// ── GET /:id — get single project ───────────────────────────────────────────
router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const project = await getProject(req.params.id);
    if (!project || project.ownerId !== uid) {
      return res.status(404).json({ error: "Project not found" });
    }
    return res.json({ project: serializeProject(project) });
  } catch (err: any) {
    console.error("[projects] get error:", err?.message || err);
    return res.status(500).json({ error: "Failed to get project" });
  }
});

// ── PATCH /:id — update project ─────────────────────────────────────────────
router.patch("/:id", requireAuth, async (req: any, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const project = await getProject(req.params.id);
    if (!project || project.ownerId !== uid) {
      return res.status(404).json({ error: "Project not found" });
    }

    const updates: Record<string, any> = {};
    if (typeof req.body?.name === "string" && req.body.name.trim()) {
      updates.name = req.body.name.trim();
    }
    if (req.body?.status === "active" || req.body?.status === "archived") {
      updates.status = req.body.status;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    await updateProject(req.params.id, updates);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[projects] update error:", err?.message || err);
    return res.status(500).json({ error: "Failed to update project" });
  }
});

// ── DELETE /:id — archive project ───────────────────────────────────────────
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const project = await getProject(req.params.id);
    if (!project || project.ownerId !== uid) {
      return res.status(404).json({ error: "Project not found" });
    }

    await deleteProject(req.params.id);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[projects] delete error:", err?.message || err);
    return res.status(500).json({ error: "Failed to delete project" });
  }
});

// ── GET /:id/assets — list project assets ───────────────────────────────────
router.get("/:id/assets", requireAuth, async (req: any, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const project = await getProject(req.params.id);
    if (!project || project.ownerId !== uid) {
      return res.status(404).json({ error: "Project not found" });
    }

    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const assets = await listProjectAssets(req.params.id, limit);
    return res.json({ assets: assets.map(serializeAsset) });
  } catch (err: any) {
    console.error("[projects] list assets error:", err?.message || err);
    return res.status(500).json({ error: "Failed to list assets" });
  }
});

// ── DELETE /:id/assets/:assetId — remove asset ─────────────────────────────
router.delete("/:id/assets/:assetId", requireAuth, async (req: any, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const project = await getProject(req.params.id);
    if (!project || project.ownerId !== uid) {
      return res.status(404).json({ error: "Project not found" });
    }

    await deleteProjectAsset(req.params.assetId, req.params.id);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[projects] delete asset error:", err?.message || err);
    return res.status(500).json({ error: "Failed to delete asset" });
  }
});

// ── POST /:id/assets/upload — upload video to existing project ──────────────
router.post("/:id/assets/upload", requireAuth, upload.single("video") as any, async (req: any, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const project = await getProject(req.params.id);
    if (!project || project.ownerId !== uid) {
      return res.status(404).json({ error: "Project not found" });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: "Invalid file type. MP4, WebM, MOV, and AVI supported." });
    }

    const title = typeof req.body?.title === "string" && req.body.title.trim()
      ? req.body.title.trim()
      : file.originalname.replace(/\.[^/.]+$/, "");

    const timestamp = Date.now();
    const safeName = title.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const ext = file.originalname.split(".").pop() || "mp4";
    const storagePath = `projects/${uid}/${req.params.id}/${timestamp}-${safeName}.${ext}`;

    await uploadVideo(file.buffer, storagePath, file.mimetype);

    const asset = await addAssetToProject({
      projectId: req.params.id,
      ownerId: uid,
      type: "upload",
      filename: `${title}.${ext}`,
      storageKey: storagePath,
      size: file.size,
      processingStatus: "ready",
    });

    return res.status(201).json({ asset: serializeAsset(asset) });
  } catch (err: any) {
    console.error("[projects] upload asset error:", err?.message || err);
    return res.status(500).json({ error: "Failed to upload asset" });
  }
});

// ── GET /:id/assets/:assetId/download — download asset ──────────────────────
router.get("/:id/assets/:assetId/download", requireAuth, async (req: any, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const project = await getProject(req.params.id);
    if (!project || project.ownerId !== uid) {
      return res.status(404).json({ error: "Project not found" });
    }

    const asset = await getProjectAsset(req.params.assetId);
    if (!asset || asset.projectId !== req.params.id) {
      return res.status(404).json({ error: "Asset not found" });
    }

    if (asset.processingStatus !== "ready") {
      return res.status(409).json({ error: "Asset is not ready yet", status: asset.processingStatus });
    }

    if (!asset.storageKey) {
      return res.status(404).json({ error: "No storage key for this asset" });
    }

    const downloadUrl = await getSignedDownloadUrl(asset.storageKey, 900);
    return res.json({
      downloadUrl,
      filename: asset.filename || "recording.mp4",
      storageKey: asset.storageKey,
      status: asset.processingStatus,
    });
  } catch (err: any) {
    console.error("[projects] download asset error:", err?.message || err);
    return res.status(500).json({ error: "Failed to get download URL" });
  }
});

export default router;
