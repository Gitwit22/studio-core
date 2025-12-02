import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, VideoConference} from "@livekit/components-react";


import "@livekit/components-styles";
import InviteButton from "../shared/InviteButton";
import StreamSetupModal from "../components/StreamSetupModal";
import RoleOverlay from "../components/RoleOverlay";


const API_BASE = "https://magdalena-bulllike-hildred.ngrok-free.dev";

type StreamStatus = "idle" | "starting" | "live" | "stopping";

function ThankYouScreen() {
  // Optional: try to close app/tab after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      // ✅ If you're in a native wrapper, call into it here instead:
      // (example) window.ReactNativeWebView?.postMessage("exit-app");

      // Browser-only best effort (only works if window was opened via script)
      try {
        window.close();
      } catch (e) {
        // ignore – user can just close tab
      }
    }, 4000); // show for 4 seconds

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

  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem("sl_displayName") ?? ""
  );
  
const [pendingName, setPendingName] = useState(displayName);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // NEW: multistream state
  const [showStreamSetup, setShowStreamSetup] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");

  const [showGoodbye, setShowGoodbye] = useState(false);
const isHost = displayName === roomName;


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
        
      }
    };

    fetchToken();
  }, [roomName, displayName, nav]);

  const handleLeftRoom = () => {
    // Instead of nav("/"), show thank-you screen
    setShowGoodbye(true);
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

  // If user has no saved name, show name input screen
if (!displayName) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4">

      {/* Join Room Form */}
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

      {/* Logo under form */}
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


  return (
    <>
      


      {/* Top bar / controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-black text-white">
        <div className="flex items-center gap-2">
          
          <button
  onClick={() => {
    if (isHost) {
      nav("/"); // Host goes back to dashboard normally
    } else {
      handleLeftRoom(); // Guest gets Thank You screen
    }
  }}
  className="text-xs underline underline-offset-4"
>
  ← Back
</button>
<button
  onClick={() => {
    localStorage.removeItem("sl_displayName");
    nav("/"); // send them back to home/login
  }}
  className="text-xs px-2 py-1 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition"
>
  Logout
</button>
          <span className="text-sm opacity-80">{roomName}</span>
        </div>

        <div className="flex items-center gap-3">

           {/* ✅ RESTORED DASHBOARD BUTTON */}
      <button
        onClick={() => setDashboardOpen(true)}
        className="text-xs px-3 py-1.5 border border-white/40 rounded hover:bg-white/10 transition"
      >
        Dashboard
      </button>
          {/* LIVE indicator */}
          <div className="flex items-center gap-1 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                streamStatus === "live" ? "bg-red-500" : "bg-gray-500"
              }`}
            />
            <span>{streamStatus === "live" ? "LIVE" : "OFFLINE"}</span>
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
  <LiveKitRoom 
    data-lk-theme="sl-layout"
    token={token}
    serverUrl={serverUrl}
    connect={true}
    onDisconnected={handleLeftRoom}      
  >

    
    <div className="relative w-full h-full">
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
