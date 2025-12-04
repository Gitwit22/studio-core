import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";

import "@livekit/components-styles";
import InviteButton from "../shared/InviteButton";
import StreamSetupModal from "../components/StreamSetupModal";
import RoleOverlay from "../components/RoleOverlay";

const API_BASE = "https://magdalena-bulllike-hildred.ngrok-free.dev";


type StreamStatus = "idle" | "starting" | "live" | "stopping";

function ThankYouScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.close();
      } catch (e) {}
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        color: "#fff",
        flexDirection: "column",
        textAlign: "center",
        padding: "1.5rem",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>
        Thank you for joining StreamLine
      </h1>
      <p style={{ maxWidth: 400, opacity: 0.8 }}>
        Your session has ended. You can now close this app or tab.
      </p>
    </div>
  );
}

export default function Room() {
  const nav = useNavigate();
  const { roomName: rn } = useParams<{ roomName: string }>();
  const roomName = rn ?? "";
const [sessionStart, setSessionStart] = useState<number | null>(null);
useEffect(() => {
  setSessionStart(Date.now());
}, []);
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem("sl_displayName") ?? ""
  );
  const [pendingName, setPendingName] = useState(displayName);

  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const [showStreamSetup, setShowStreamSetup] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");

  const [showGoodbye, setShowGoodbye] = useState(false);
  const isHost = displayName === roomName;

  // --- token fetch ---
  useEffect(() => {
    if (!roomName || !displayName) return;

    const fetchToken = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/roomToken`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
  roomName,
  identity: displayName,
  uid: localStorage.getItem("sl_userId"),   // 🔥 ADD THIS
}),

        });

        if (!res.ok) {
          console.error("roomToken HTTP error", res.status);
          throw new Error("Failed to get token");
        }

        const data = await res.json();
        console.log("roomToken response:", data);

        const tokenFromApi =
          data.token || data.accessToken || data.jwt || data.roomToken;
        const serverUrlFromApi =
          data.serverUrl || data.url || data.livekitUrl || data.wsUrl;

        if (!tokenFromApi || !serverUrlFromApi) {
          console.error("Missing token or serverUrl in roomToken response");
          return;
        }

        setToken(tokenFromApi);
        setServerUrl(serverUrlFromApi);
      } catch (err) {
        console.error("fetchToken error:", err);
      }
    };

    fetchToken();
  }, [roomName, displayName]);

  const handleLeftRoom = () => {
    setShowGoodbye(true);
  };

  const handleEndStream = async () => {
  const uid = localStorage.getItem("sl_userId");

  try {
    if (uid) {
      let minutes = 0;
      if (sessionStart) {
        minutes = Math.max(
          1,
          Math.round((Date.now() - sessionStart) / 60000)
        );
      }

      await fetch(`${API_BASE}/api/usage/streamEnded`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          minutes,
          guestCount: 0,
        }),
      });
    }
  } catch (err) {
    console.error("Failed to log usage:", err);
  }

  handleLeftRoom();
};


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

  // --- conditional screens ---

  if (!displayName) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4">
        <form
          className="bg-zinc-900 rounded-xl px-6 py-5 w-full max-w-sm space-y-4 shadow-lg"
          onSubmit={(e) => {
            e.preventDefault();
            const name = pendingName.trim();
            if (!name) return;
            localStorage.setItem("sl_displayName", name);
            setDisplayName(name);
          }}
        >
          <h1 className="text-xl font-semibold text-center">
            Enter your name to join
          </h1>

          <input
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm outline-none"
            placeholder="Your name"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
          />

          <button
            type="submit"
            className="mt-2 w-full py-2 rounded bg-indigo-600 text-sm font-medium hover:bg-indigo-500 transition"
          >
            Join Room
          </button>



          
        </form>

        <img
          src="/logo.png"
          alt="StreamLine Logo"
          className="mt-6 w-40 opacity-90"
        />
      </div>
    );
  }

  if (showGoodbye) {
    return <ThankYouScreen />;
  }

  // --- main render ---

  return (
    <>
      {/* Top bar / controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-black text-white">
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (isHost) {
                await handleEndStream();
                nav("/join");
              } else {
                handleLeftRoom();
              }
            }}
            className="text-xs underline underline-offset-4"
          >
            ← Back
          </button>

          <button
            onClick={() => {
              localStorage.removeItem("sl_displayName");
              nav("/");
            }}
            className="text-xs px-2 py-1 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition"
          >
            Logout
          </button>

          <span className="text-sm opacity-80">{roomName}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setDashboardOpen(true)}
            className="text-xs px-3 py-1.5 border border-white/40 rounded hover:bg-white/10 transition"
          >
            Dashboard
          </button>

          <div className="flex items-center gap-1 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                streamStatus === "live" ? "bg-red-500" : "bg-gray-500"
              }`}
            />
            <span>{streamStatus === "live" ? "LIVE" : "OFFLINE"}</span>
          </div>

          <button
            onClick={() => setShowStreamSetup(true)}
            className="px-2 py-1 text-xs rounded bg-indigo-600"
          >
            {streamStatus === "live" ? "Manage Stream" : "Setup Stream"}
          </button>

          <InviteButton roomName={roomName} />
        </div>
      </div>

      {/* Debug status – remove later */}
      <div className="mt-4 text-xs text-zinc-400 px-4">
        <div>displayName: {displayName || "(none)"}</div>
        <div>roomName: {roomName || "(none)"}</div>
        <div>token: {token ? "yes" : "no"}</div>
        <div>serverUrl: {serverUrl || "(none)"}</div>
      </div>

      {/* Main LiveKit view */}
      {token && serverUrl && (
       <LiveKitRoom
  data-lk-theme="default"        // use LiveKit’s default theme
  className="sl-layout"          // 🔥 this is what your CSS is looking for
  token={token}
  serverUrl={serverUrl}
  connect={true}
  onDisconnected={handleLeftRoom}
>
  <div className="relative w-full max-w-5xl mx-auto mt-4 aspect-video">
            <VideoConference />

             <img
  src="/logo.png"
  alt="StreamLine Logo"
  className="hidden md:block absolute right-10 bottom-10 w-[300px] h-auto opacity-85 pointer-events-none"
  style={{
    position: "absolute",
    right: "60px",    // move left/right
    bottom: "-289px",   // move up/down
    width: "300px",   // ← actual size (make this smaller/bigger)
    height: "auto",
    opacity: 0.85,
    pointerEvents: "none",
  }}
/>

            <RoleOverlay
              open={dashboardOpen}
              onClose={() => setDashboardOpen(false)}
              role="host"
              roomName={roomName}
            />
          </div>
        </LiveKitRoom>

        
      )}



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
