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
 *   DELETE /api/projects/:id/assets/:assetId — Remove asset
 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  listProjectAssets,
  deleteProjectAsset,
} from "../lib/projectManager";

const router = Router();

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
    return res.json({ projects });
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
    return res.status(201).json({ project });
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
    return res.json({ project });
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
    return res.json({ assets });
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

export default router;
