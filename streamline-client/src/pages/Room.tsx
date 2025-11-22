import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, VideoConference, Chat } from "@livekit/components-react";


import "@livekit/components-styles";
import InviteButton from "../shared/InviteButton";
import StreamSetupModal from "../components/StreamSetupModal";

const API_BASE = "https://magdalena-bulllike-hildred.ngrok-free.dev";

type StreamStatus = "idle" | "starting" | "live" | "stopping";

export default function Room() {
  const nav = useNavigate();
  const { roomName: rn } = useParams<{ roomName: string }>();
  const roomName = rn ?? "";

  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem("sl_displayName") ?? ""
  );
  
const [pendingName, setPendingName] = useState(displayName);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  // NEW: multistream state
  const [showStreamSetup, setShowStreamSetup] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");

  // --- existing token fetch logic here ---
  useEffect(() => {
    if (!roomName || !displayName) return;

    const fetchToken = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/roomToken`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName, identity: displayName }),
        });

        if (!res.ok) {
          throw new Error("Failed to get token");
        }

        const data = await res.json();
        setToken(data.token);
        setServerUrl(data.serverUrl);
      } catch (err) {
        console.error(err);
        nav("/");
      }
    };

    fetchToken();
  }, [roomName, displayName, nav]);

  const handleStartMultistream = async (keys: {
    youtubeKey?: string;
    facebookKey?: string;
  }) => {
    if (!roomName) {
      alert("No room name");
      return;
    }

    try {
      setStreamStatus("starting");

      const res = await fetch(
        `${API_BASE}/api/rooms/${encodeURIComponent(
          roomName
        )}/start-multistream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            youtubeStreamKey: keys.youtubeKey,
            facebookStreamKey: keys.facebookKey,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Start multistream failed", errData);
        alert("Failed to start multistream");
        setStreamStatus("idle");
        return;
      }

      const data = await res.json();
      setEgressId(data.egressId);
      setStreamStatus("live");
    } catch (err) {
      console.error(err);
      alert("Error starting multistream");
      setStreamStatus("idle");
    }
  };

  const handleStopMultistream = async () => {
    if (!egressId) {
      alert("No active stream");
      return;
    }

    try {
      setStreamStatus("stopping");

      const res = await fetch(`${API_BASE}/api/rooms/stop-multistream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ egressId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Stop multistream failed", errData);
        alert("Failed to stop multistream");
        setStreamStatus("live");
        return;
      }

      setEgressId(null);
      setStreamStatus("idle");
    } catch (err) {
      console.error(err);
      alert("Error stopping multistream");
      setStreamStatus("live");
    }
  };

  // If user has no saved name, show name input screen
if (!displayName) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <form
        className="bg-zinc-900 rounded-xl px-6 py-4 w-full max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const name = pendingName.trim();
          if (!name) return;
          localStorage.setItem("sl_displayName", name);
          setDisplayName(name);
        }}
      >
        <h1 className="text-lg font-semibold mb-2">
          Enter your name to join the stream
        </h1>

        <input
          className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm outline-none"
          placeholder="Your name"
          value={pendingName}
          onChange={(e) => setPendingName(e.target.value)}
        />

        <button
          type="submit"
          className="mt-2 w-full py-2 rounded bg-indigo-600 text-sm font-medium"
        >
          Join Room
        </button>
      </form>
    </div>
  );
}


  return (
    <>
      


      {/* Top bar / controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-black text-white">
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav("/")}
            className="text-xs underline underline-offset-4"
          >
            ← Back
          </button>
          <span className="text-sm opacity-80">{roomName}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* LIVE indicator */}
          <div className="flex items-center gap-1 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                streamStatus === "live" ? "bg-red-500" : "bg-gray-500"
              }`}
            />
            <span>{streamStatus === "live" ? "LIVE" : "OFF"}</span>
          </div>

          {/* Setup Stream button */}
          <button
            onClick={() => setShowStreamSetup(true)}
            className="px-2 py-1 text-xs rounded bg-indigo-600"
          >
            {streamStatus === "live" ? "Manage Stream" : "Setup Stream"}
          </button>

          <InviteButton roomName={roomName} />
        </div>
      </div>

      {/* Main LiveKit view */}
      {token && serverUrl && (
        <LiveKitRoom token={token} serverUrl={serverUrl} connect={true}>
          <div className="lk-layout">
            <VideoConference />
            <Chat />
          </div>
        </LiveKitRoom>
    
      )}

      {/* Stream setup modal */}
      <StreamSetupModal
        isOpen={showStreamSetup}
        onClose={() => setShowStreamSetup(false)}
        onStart={handleStartMultistream}
        onStop={handleStopMultistream}
        status={streamStatus}
      />
    </>
  );
}
