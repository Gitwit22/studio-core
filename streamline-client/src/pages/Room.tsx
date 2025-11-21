import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, VideoConference, Chat } from "@livekit/components-react";
import "@livekit/components-styles";
import InviteButton from "../shared/InviteButton";
import RoleOverlay from "../components/RoleOverlay";

const API_BASE = import.meta.env.VITE_API_BASE || ""; // use Vite proxy if empty

export default function Room() {
  const nav = useNavigate();
  const { roomName: rn } = useParams<{ roomName: string }>();
  const roomName = rn ?? "";

  const [displayName] = useState(
    () => localStorage.getItem("sl_displayName") ?? ""
  );

  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [openDash, setOpenDash] = useState<boolean>(false);

  // Role from query string (?role=host|moderator|participant)
  // Default YOU to host if nothing is set.
  const role = useMemo(() => {
    const raw =
      new URLSearchParams(window.location.search)
        .get("role")
        ?.toLowerCase() ?? "host";
    if (raw === "host" || raw === "moderator" || raw === "participant") {
      return raw;
    }
    return "host";
  }, []) as "host" | "moderator" | "participant";

  useEffect(() => {
    if (!roomName || !displayName) {
      nav("/");
      return;
    }
    (async () => {
      try {
        const qs = new URLSearchParams({
          room: roomName,
          identity: displayName,
          role, // send role to server
        }).toString();
        const res = await fetch(`${API_BASE}/api/token?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setToken(data.token);
        setServerUrl(data.url);
      } catch (e: any) {
        setError(e.message ?? "token_error");
      }
    })();
  }, [roomName, displayName, nav, role]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">Error: {error}</p>
        <button onClick={() => nav("/")} className="underline mt-2">
          Go back
        </button>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            Room: {roomName || "…"}
            <span className="ml-2 text-sm opacity-60">({role})</span>
          </h1>
          {!!roomName && <InviteButton roomName={roomName} />}
        </div>
        <p className="mt-6 opacity-70">Preparing your room…</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#111] text-white relative overflow-hidden">
      {/* Top actions bar */}
      <div className="absolute top-2 left-2 z-50 flex gap-2">
        <InviteButton roomName={roomName} />
        <button
          onClick={() => setShowChat((v) => !v)}
          className="rounded-xl px-3 py-2 border shadow bg-white/80 text-black"
          title="Toggle chat"
        >
          {showChat ? "Hide Chat" : "Show Chat"}
        </button>
        <button
          onClick={() => setOpenDash((v) => !v)}
          className="rounded-xl px-3 py-2 border shadow bg-white/80 text-black"
          title="Toggle dashboard"
        >
          {openDash ? "Close Dashboard" : "Dashboard"}
        </button>
      </div>

      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        video
        audio
        onDisconnected={() => nav("/")}
      >
        {/* Main layout: centered video stage + optional chat sidebar */}
        <div className="h-full w-full flex flex-col md:flex-row items-center justify-center">
          {/* Video stage */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <div className="w-full max-w-[900px] h-[20vh] md:h-[55vh] bg-black rounded-xl overflow-hidden shadow-lg">
              <VideoConference />
            </div>
          </div>

          {/* Chat side panel */}
          {showChat && (
            <aside className="md:w-[22rem] w-full h-[40vh] md:h-[55vh] border-t md:border-t-0 md:border-l bg-white text-black p-3 overflow-y-auto">
              <Chat />
            </aside>
          )}
        </div>

        {/* Role-based overlay dashboard (sits on top of stage) */}
        <RoleOverlay
          open={openDash}
          onClose={() => setOpenDash(false)}
          role={role}
          roomName={roomName}
        />
      </LiveKitRoom>
    </div>
  );
}
