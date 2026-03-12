/**
 * Projects API Client — Core media-workspace access
 *
 * Calls /api/projects endpoints. Independent of editing feature flags.
 */

import { API_BASE } from "./apiBase";
import { apiFetchAuth } from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  createdBy: string;
  status: "active" | "archived";
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
  sourceRoomId: string | null;
  sourceRoomName: string | null;
}

export type AssetType =
  | "recording"
  | "upload"
  | "render"
  | "clip"
  | "thumbnail"
  | "transcript";

export interface ProjectAsset {
  id: string;
  projectId: string;
  ownerId: string;
  type: AssetType;
  sourceRoomId: string | null;
  sourceRecordingId: string | null;
  filename: string;
  storageKey: string;
  duration: number | null;
  resolution: string | null;
  size: number | null;
  processingStatus: "pending" | "processing" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function listProjects(limit = 50): Promise<Project[]> {
  const res = await apiFetchAuth(`${API_BASE}/api/projects?limit=${limit}`);
  const data = await res.json();
  return data.projects ?? [];
}

export async function createProject(name: string): Promise<Project> {
  const res = await apiFetchAuth(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  return data.project;
}

export async function getProject(id: string): Promise<Project> {
  const res = await apiFetchAuth(`${API_BASE}/api/projects/${encodeURIComponent(id)}`);
  const data = await res.json();
  return data.project;
}

export async function updateProject(
  id: string,
  updates: { name?: string; status?: "active" | "archived" },
): Promise<void> {
  await apiFetchAuth(`${API_BASE}/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetchAuth(`${API_BASE}/api/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listProjectAssets(
  projectId: string,
  limit = 100,
): Promise<ProjectAsset[]> {
  const res = await apiFetchAuth(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/assets?limit=${limit}`,
  );
  const data = await res.json();
  return data.assets ?? [];
}

export async function deleteProjectAsset(
  projectId: string,
  assetId: string,
): Promise<void> {
  await apiFetchAuth(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,
    { method: "DELETE" },
  );
}
