import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Hls from "hls.js";
import { API_BASE } from "../lib/apiBase";

type RoomResolveResponse = {
  roomId?: string;
  roomName?: string;
  role?: string;
};

type PublicHlsResponse = {
  status?: "idle" | "starting" | "live" | "error";
  playlistUrl?: string | null;
  error?: string | null;
};

export default function Live() {
  const params = useParams<{ roomId?: string }>();
  const [searchParams] = useSearchParams();

  const token = (searchParams.get("t") || "").trim();
  const routeRoomId = (params.roomId || "").trim();

  const [roomId, setRoomId] = useState<string>(routeRoomId);
  const [roomName, setRoomName] = useState<string>("");
  const [role, setRole] = useState<string>("");

  const [hlsStatus, setHlsStatus] = useState<PublicHlsResponse["status"]>("idle");
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setRoomId(routeRoomId);
  }, [routeRoomId]);

  // HLS playback:
  // - Safari/iOS: native HLS via video.src
  // - Chrome/Firefox/Edge: hls.js
  useEffect(() => {
    const video = videoRef.current;
    if (!playlistUrl || !video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari
      video.src = playlistUrl;
      return;
    }

    if (Hls.isSupported()) {
      // Chrome / Firefox / Edge
      const hls = new Hls();
      hls.loadSource(playlistUrl);
      hls.attachMedia(video);

      return () => {
        hls.destroy();
      };
    }
  }, [playlistUrl]);

  // Resolve token -> canonical roomId/roomName (preferred)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError(null);

        if (!token) {
          // If no token, we still allow a direct /live/:roomId view (public HLS).
          // If you want strict token-only, enforce it here.
          return;
        }

        const res = await fetch(`${API_BASE}/api/rooms/resolve`, {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          setError("Invalid or expired link");
          return;
        }
        const data = (await res.json().catch(() => null)) as RoomResolveResponse | null;
        if (!data || cancelled) return;

        const nextRoomId = String(data.roomId || "").trim();
        const nextRoomName = String(data.roomName || "").trim();
        const nextRole = String(data.role || "").trim();

        if (nextRoomId) setRoomId(nextRoomId);
        if (nextRoomName) setRoomName(nextRoomName);
        if (nextRole) setRole(nextRole);
      } catch {
        setError("Failed to resolve link");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Fetch HLS status + playlist URL by roomId.
  // If token is present, prefer the authenticated endpoint; otherwise fall back to public.
  useEffect(() => {
    let cancelled = false;
    const currentRoomId = (roomId || routeRoomId || "").trim();
    if (!currentRoomId) return;

    const looksLikeName =
      currentRoomId.includes(" ") || currentRoomId.includes("–") || currentRoomId.includes("#");

    if (looksLikeName) {
      setError("HLS must use Firestore roomId, not roomName.");
      return;
    }

    const run = async () => {
      try {
        const url = token
          ? `${API_BASE}/api/hls/status/${encodeURIComponent(currentRoomId)}`
          : `${API_BASE}/api/public/hls/${encodeURIComponent(currentRoomId)}`;

        const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as PublicHlsResponse | null;
        if (!data || cancelled) return;
        const nextStatus = (data.status || "idle") as any;
        setHlsStatus(nextStatus);
        setPlaylistUrl(data.playlistUrl ?? null);
        if (nextStatus === "idle" && playlistUrl) {
          setEnded(true);
        }
        if (nextStatus === "live") {
          setEnded(false);
        }
        if (nextStatus === "error" && data.error) {
          setError(String(data.error));
        }
      } catch {
        // ignore
      }
    };

    run();
    const t = window.setInterval(run, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [roomId, routeRoomId, token, playlistUrl]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Live Viewer</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {ended ? "Stream ended." : "Waiting for the host to start HLS"}
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
          {error}
        </div>
      )}

      {role && (
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Link role: <b>{role}</b>
        </div>
      )}

      <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>HLS Status</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{hlsStatus || "idle"}</div>
        {playlistUrl && (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9, wordBreak: "break-all" }}>{playlistUrl}</div>
        )}
      </div>

      {playlistUrl ? (
        <video
          ref={videoRef}
          controls
          playsInline
          style={{ width: "100%", maxWidth: 980, borderRadius: 12, background: "#111" }}
        />
      ) : (
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          {ended ? "Stream ended." : "Waiting for the host to start HLS..."}
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.65 }}>
        Note: Some browsers require HLS support (Safari works natively). If video doesn’t play in Chrome, we can add hls.js.
      </div>
    </div>
  );
}
