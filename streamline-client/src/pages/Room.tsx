import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { useLocalParticipantPermissions } from "@livekit/components-react";
import "@livekit/components-styles";
import InviteButton from "../shared/InviteButton";
import StreamSetupModal from "../components/StreamSetupModal";
import RoleOverlay from "../components/RoleOverlay";
import { mockRecordingApi } from "../services/mockRecording";

// Use relative paths - Vite proxy forwards /api/* to http://localhost:5137
const API_BASE = "";

type StreamStatus = "idle" | "starting" | "live" | "stopping";
type RecordingStatus = "idle" | "recording" | "stopping";

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

function getOrCreateUid() {
  let uid = localStorage.getItem("sl_userId");
  if (!uid) {
    uid = localStorage.getItem("sl_guestId") || null;
  }
  if (!uid) {
    const rand = Math.random().toString(36).slice(2, 10);
    uid = `guest_${rand}`;
    localStorage.setItem("sl_guestId", uid);
  }
  return uid;
}

export default function Room() {
  const nav = useNavigate();
  const { roomName: rn } = useParams<{ roomName: string }>();
  const roomName = rn ?? "";
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  
  useEffect(() => {
    setSessionStart(Date.now());
    // Store room name for exit page check
    localStorage.setItem("sl_roomName", roomName);
  }, [roomName]);

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
  // First person to join is the host (based on localStorage flag for this room)
  const isHost = !localStorage.getItem(`sl_room_${roomName}_hasHost`);

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const recordingRef = useRef<string | null>(null);
  const [viewerCount] = useState(Math.floor(Math.random() * 200) + 10);

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
            uid: getOrCreateUid(),
          }),
        });

        if (!res.ok) {
          console.error("roomToken HTTP error", res.status);
          return;
        }

        const data = await res.json();
        const tokenFromApi =
          data.token || data.accessToken || data.jwt || data.roomToken;
        const serverUrlFromApi =
          data.serverUrl || data.server_url || data.url || data.livekitUrl;

        if (tokenFromApi && serverUrlFromApi) {
          setToken(tokenFromApi);
          setServerUrl(serverUrlFromApi);
        }
      } catch (err) {
        console.error("fetchToken error:", err);
      }
    };

    fetchToken();
  }, [roomName, displayName]);

  const handleLeftRoom = () => {
    setShowGoodbye(true);
  };

  const startRecording = async () => {
    try {
      setRecordingStatus("recording");
      const result = await mockRecordingApi.startRecording(
        roomName || "unknown",
        `Stream - ${new Date().toLocaleString()}`
      );
      setRecordingId(result.id);
      recordingRef.current = result.id;
    } catch (error) {
      console.error("Failed to start recording:", error);
      setRecordingStatus("idle");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    setRecordingStatus("stopping");

    try {
      await mockRecordingApi.stopRecording(recordingRef.current, {
        viewerCount: viewerCount,
        peakViewers: viewerCount,
      });

      setTimeout(() => {
        nav(`/room-exit/${recordingRef.current}`);
      }, 1000);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setRecordingStatus("idle");
    }
  };

  useEffect(() => {
    if (isHost && token && !recordingRef.current) {
      startRecording();
    }
  }, [isHost, token]);

  const handleEndStream = async () => {
    if (recordingStatus === "recording") {
      await stopRecording();
      return;
    }

    const uid = localStorage.getItem("sl_userId");

    try {
      if (uid) {
        let minutes = 0;
        if (sessionStart) {
          minutes = Math.max(1, Math.round((Date.now() - sessionStart) / 60000));
        }

        await fetch(`${API_BASE}/api/usage/streamEnded`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid,
            minutes,
            guestCount: viewerCount,
          }),
        });
      }
    } catch (err) {
      console.error("Failed to log usage:", err);
    }

    // If we have a recording, navigate to post-stream summary
    if (recordingId) {
      nav(`/editing/post-stream?recordingId=${recordingId}&newRecording=${recordingId}`);
    } else {
      handleLeftRoom();
    }
  };

  const handleStartMultistream = async (keys: {
    youtubeKey?: string;
    facebookKey?: string;
    twitchKey?: string;
  }) => {
    if (!roomName) {
      alert("No room name");
      return;
    }

    try {
      setStreamStatus("starting");

      // Get userId from localStorage
      const userId = localStorage.getItem("sl_userId");
      if (!userId) {
        alert("User ID not found. Please log in again.");
        setStreamStatus("idle");
        return;
      }

      const res = await fetch(
        `${API_BASE}/api/rooms/${encodeURIComponent(roomName)}/start-multistream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            youtubeStreamKey: keys.youtubeKey,
            facebookStreamKey: keys.facebookKey,
            twitchStreamKey: keys.twitchKey,
            userId, // ← Add userId
            guestCount: viewerCount, // ← Add viewer count
          }),
        }
      );

      if (!res.ok) {
        alert("Failed to start multistream");
        setStreamStatus("idle");
        return;
      }

      const data = await res.json();
      setEgressId(data.egressId);
      setStreamStatus("live");
    } catch (err) {
      console.error("Error starting multistream", err);
      alert("Error starting multistream");
      setStreamStatus("idle");
    }
  };

  const handleStopMultistream = async () => {
    if (!egressId) {
      alert("No active stream");
      return;
    }

    if (!roomName) {
      alert("No room name");
      return;
    }

    try {
      setStreamStatus("stopping");

      const res = await fetch(
        `${API_BASE}/api/rooms/${encodeURIComponent(roomName)}/stop-multistream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ egressId }),
        }
      );

      if (!res.ok) {
        alert("Failed to stop multistream");
        setStreamStatus("live");
        return;
      }

      setEgressId(null);
      setStreamStatus("idle");
    } catch (err) {
      console.error("Error stopping multistream", err);
      alert("Error stopping multistream");
      setStreamStatus("live");
    }
  };

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
            // Mark this room as having a host (first joiner is host)
            if (isHost) {
              localStorage.setItem(`sl_room_${roomName}_hasHost`, "true");
            }
            setDisplayName(name);
          }}
        >
          <h1 className="join-instructions text-xl font-semibold text-center">
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

        <p className="join-instructions text-xs text-center mt-3">
          When you enter the room, tap the microphone and camera icons to enable audio and video.
        </p>

        <img
          src="/logosmall.png"
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
      {recordingStatus === "recording" && (
        <div className="fixed bottom-4 left-4 flex items-center gap-2 bg-red-600 px-4 py-3 rounded-lg shadow-lg z-40">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
          <span className="text-sm font-bold">RECORDING</span>
          <span className="text-xs text-gray-200 ml-2">{recordingId}</span>
        </div>
      )}

      <div className="fixed top-4 right-4 bg-black/80 border border-gray-700 rounded-lg p-3 text-sm z-40">
        <div className="text-gray-400">
          👥 <span className="text-white font-bold">{viewerCount}</span> viewers
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2 bg-black text-white sl-topbar border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (isHost) {
                await handleEndStream();
              } else {
                handleLeftRoom();
              }
            }}
            disabled={recordingStatus === "stopping"}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold text-sm transition disabled:opacity-50"
          >
            {recordingStatus === "stopping" ? "⏳ Ending..." : "Exit Room"}
          </button>

          <span className="text-sm opacity-80 ml-4">{roomName}</span>
        </div>

        {isHost && (
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
              className="px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500"
            >
              {streamStatus === "live" ? "Manage Stream" : "Setup Stream"}
            </button>

            <InviteButton roomName={roomName} />
          </div>
        )}
      </div>

      {token && serverUrl && (
        <LiveKitRoom
          data-lk-theme="default"
          className="sl-layout"
          token={token}
          serverUrl={serverUrl}
          connect={true}
          onDisconnected={handleLeftRoom}
          style={{
            width: "100%",
            height: "calc(100vh - 60px)",
            position: "relative",
          }}
        >
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <VideoConference />
            <img
              src="/logosmall.png"
              className="sl-watermark"
              alt="StreamLine Logo"
            />
          </div>

          <RoleOverlay
            open={dashboardOpen}
            onClose={() => setDashboardOpen(false)}
            role="host"
            roomName={roomName}
          />
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
