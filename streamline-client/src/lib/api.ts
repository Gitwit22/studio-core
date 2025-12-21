import { API_BASE } from "./apiBase";

export async function getToken(
  roomId: string,
  userId: string,
  role: "host" | "guest"
) {
  const res = await fetch(`${API_BASE}/v1/rooms/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, userId, role }),
  });

  if (!res.ok) {
    throw new Error(`Token error ${res.status}`);
  }

  return res.json() as Promise<{ token: string; wsUrl: string }>;
}

export async function apiStartRecording(
  roomName: string,
  layout: "speaker" | "grid"
) {
  const res = await fetch(`${API_BASE}/api/recordings/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomName, layout }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ recordingId: string }>;
}

export async function apiStopRecording(recordingId: string) {
  const res = await fetch(`${API_BASE}/api/recordings/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordingId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: true }>;
}
