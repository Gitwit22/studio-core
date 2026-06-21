import type { SessionSnapshot } from "@/studio/types/studio"

type ApiEnvelope<T> = {
  success: boolean
  data: T
}

export type StudioStateRecord = {
  workspaceId: string
  state: SessionSnapshot
  updatedAt: string
  createdAt: string
}

export function stableSnapshotHash(snapshot: SessionSnapshot): string {
  return JSON.stringify(snapshot)
}

export function normalizeApiBaseUrl(configured: string): string {
  const trimmed = configured.replace(/\/+$/, "")

  if (/\/api\/v1$/i.test(trimmed)) {
    return trimmed
  }

  if (/\/v1$/i.test(trimmed)) {
    return trimmed.replace(/\/v1$/i, "/api/v1")
  }

  return trimmed
}

export function getStudioApiBaseUrl(hostname = window.location.hostname): string | null {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) {
    return normalizeApiBaseUrl(configured)
  }

  if (hostname === "localhost") {
    return "http://localhost:4000/api/v1"
  }

  return null
}

export function getStudioWorkspaceId(hostname = window.location.hostname): string {
  const configured = import.meta.env.VITE_STUDIO_WORKSPACE_ID?.trim()
  if (configured) {
    return configured
  }

  return hostname.replace(/[^a-zA-Z0-9_-]/g, "_") || "default"
}

export async function fetchStudioState(
  apiBaseUrl: string,
  workspaceId: string,
): Promise<StudioStateRecord | null> {
  const response = await fetch(`${apiBaseUrl}/studio-core/state/${encodeURIComponent(workspaceId)}`)
  if (!response.ok) {
    return null
  }

  const payload = await response.json() as ApiEnvelope<StudioStateRecord | null>
  return payload?.data ?? null
}

export async function pushStudioState(
  apiBaseUrl: string,
  workspaceId: string,
  state: SessionSnapshot,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/studio-core/state/${encodeURIComponent(workspaceId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    body: JSON.stringify({ state }),
  })

  if (!response.ok) {
    throw new Error(`Failed to persist studio state: ${response.status}`)
  }
}

export function canHydrateFromCloud(snapshot: SessionSnapshot): boolean {
  return snapshot.tracks.length > 0 || snapshot.clips.length > 0 || snapshot.sources.length > 0
}
