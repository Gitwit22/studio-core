import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import InviteButton from "../shared/InviteButton";

const API_BASE = import.meta.env.VITE_API_BASE || ""; // empty = Vite proxy

export default function Room() {
  const nav = useNavigate();

  // useParams always returns possibly-undefined; normalize to string
  const { roomName: rn } = useParams<{ roomName: string }>();
  const roomName = rn ?? "";

  const [displayName] = useState<string>(
    () => localStorage.getItem("sl_displayName") ?? ""
  );

  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard: if either is missing, go back to lobby
    if (!roomName || !displayName) {
      nav("/");
      return;
    }

    (async () => {
      try {
        const qs = new URLSearchParams({ room: roomName, identity: displayName }).toString();
        const res = await fetch(`${API_BASE}/api/token?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setToken(data.token);
        setServerUrl(data.url);
      } catch (e: any) {
        console.error("Token fetch error:", e);
        setError(e.message ?? "token_error");
      }
    })();
  }, [roomName, displayName, nav]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">Error: {error}</p>
        <button onClick={() => nav("/")}>Go back</button>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="p-6">
        <h2>Joining <b>{roomName || "…"}</b>…</h2>
        {!!roomName && <InviteButton roomName={roomName} />}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative">
      <div className="absolute top-3 right-3 z-50">
        <InviteButton roomName={roomName} />
      </div>
      <LiveKitRoom token={token} serverUrl={serverUrl} connect video audio>
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
