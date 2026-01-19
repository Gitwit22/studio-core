
import { API_BASE } from "./apiBase";

/**
 * Read the auth token from localStorage for header-based auth fallback.
 * This complements the httpOnly cookie so that browsers or webviews that
 * block third-party cookies can still authenticate via Authorization.
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem("sl_token") ||
      window.localStorage.getItem("auth_token") ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * API helper that always sends credentials and, when available, a
 * Bearer token header. Callers should pass a path like "/api/...";
 * this helper will prepend API_BASE. Absolute URLs are also accepted
 * and will be used as-is.
 */
export async function apiFetch(path: string, init: RequestInit = {}, options?: { allowNonOk?: boolean }) {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});

  // Default JSON content-type when sending a body unless overridden.
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Header-based auth fallback: prefer explicit Authorization on init,
  // otherwise attach the stored token if present.
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!options?.allowNonOk && !res.ok) {
    let errBody: any = null;
    try {
      errBody = await res.json();
    } catch {}
    throw Object.assign(new Error(`HTTP ${res.status}`), {
      status: res.status,
      body: errBody,
    });
  }
  return res;
}

export async function getToken(
  roomId: string,
  userId: string,
  role: "host" | "guest"
) {
  const res = await apiFetch("/v1/rooms/token", {
    method: "POST",
    body: JSON.stringify({ roomId, userId, role }),
  });
  return res.json() as Promise<{ token: string; wsUrl: string }>;
}

export async function apiStartRecording(
  roomId: string,
  layout: "speaker" | "grid",
  mode: "cloud" | "dual" = "cloud",
  presetId?: string
) {
  const res = await apiFetch("/api/recordings/start", {
    method: "POST",
    body: JSON.stringify({ roomId, layout, mode, presetId }),
  });
  return res.json();
}

export async function apiStopRecording(recordingId: string) {
  const res = await apiFetch("/api/recordings/stop", {
    method: "POST",
    body: JSON.stringify({ recordingId }),
  });
  return res.json() as Promise<{ ok: true }>;
}

export function clearAuthStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("sl_token");
    window.localStorage.removeItem("sl_user");
    window.localStorage.removeItem("sl_userId");
  } catch {}
}
