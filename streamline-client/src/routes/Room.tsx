import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();

  const name = (searchParams.get('name') || 'Guest').toString();
  const role = (searchParams.get('role') || 'participant').toString();

  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string>('');

  // Option B (your choice): using LIVEKIT_URL (vite.config.ts has envPrefix ['VITE_', 'LIVEKIT_'])
  const serverUrl = import.meta.env.LIVEKIT_URL as string | undefined;

  useEffect(() => {
    if (!serverUrl) {
      setErr('LIVEKIT_URL is missing in .env. Add it and restart the dev server.');
      return;
    }

    if (!(window.isSecureContext || location.hostname === 'localhost')) {
      console.warn('Not a secure context — camera/mic may be blocked by the browser.');
    }

    console.log('Connecting to LiveKit at:', serverUrl);

    const url =
      `/v1/rooms/token` +
      `?roomName=${encodeURIComponent(roomId || 'default')}` +
      `&name=${encodeURIComponent(name)}` +
      `&role=${encodeURIComponent(role)}`;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Token HTTP ${res.status}`);
        const data = await res.json();
        if (!data?.token) throw new Error('No token in response');
        console.log('Token received:', String(data.token).slice(0, 24) + '...');
        setToken(data.token);
      })
      .catch((e: any) => setErr('Token fetch failed: ' + e.message));
  }, [roomId, name, role, serverUrl]);

  if (err) {
    return <div style={{ padding: 16, color: 'crimson' }}>Error: {err}</div>;
  }
  if (!serverUrl) {
    return <div style={{ padding: 16 }}>Missing LiveKit URL</div>;
  }
  if (!token) {
    return <div style={{ padding: 16 }}>Joining room: {roomId || '(default)'}...</div>;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      video
      audio
      onError={(e) => setErr('LiveKit error: ' + e.message)}
      style={{ height: '100vh' }}
    >
      <VideoConference />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
