export async function getToken(roomId: string, userId: string, role: 'host' | 'guest') {
  const res = await fetch(`${import.meta.env.VITE_API_BASE}/v1/rooms/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, userId, role }),
  });

  if (!res.ok) throw new Error(`Token error ${res.status}`);
  return res.json() as Promise<{ token: string; wsUrl: string }>;
}
