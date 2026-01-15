import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Hls from "hls.js";
import { API_BASE } from "../lib/apiBase";
import {
  Radio,
  RefreshCw,
  Volume2,
  VolumeX,
  Maximize,
  Users,
  Signal,
  AlertCircle,
  Link2,
  Copy,
} from "lucide-react";
import logoUrl from "../assets/logosmaller.png"; 

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

type StreamStatus = "loading" | "live" | "starting" | "offline" | "error";

function looksLikeRoomName(value: string) {
  // Your “never treat roomName as roomId” invariant
  return value.includes(" ") || value.includes("–") || value.includes("#");
}

function canNativeHls(video: HTMLVideoElement) {
  return video.canPlayType("application/vnd.apple.mpegurl") !== "";
}

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

  // UI state
  const [status, setStatus] = useState<StreamStatus>("loading");
  const [isMuted, setIsMuted] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [copied, setCopied] = useState<null | "viewer" | "playlist">(null);

  // NOTE: viewerCount is a placeholder until you wire a real metric
  const viewerCount = useMemo(() => 0, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // keep local roomId in sync with route
  useEffect(() => {
    setRoomId(routeRoomId);
  }, [routeRoomId]);

  // Resolve token -> canonical roomId/roomName (preferred)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError(null);

        if (!token) {
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
  const fetchHlsStatus = useCallback(async () => {
    const currentRoomId = (roomId || routeRoomId || "").trim();
    if (!currentRoomId) return;

    if (looksLikeRoomName(currentRoomId)) {
      setError("HLS must use Firestore roomId, not roomName.");
      setStatus("error");
      return;
    }

    setIsRetrying(true);
    try {
      const url = token
        ? `${API_BASE}/api/hls/status/${encodeURIComponent(currentRoomId)}`
        : `${API_BASE}/api/public/hls/${encodeURIComponent(currentRoomId)}`;

      const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      if (!res.ok) return;

      const data = (await res.json().catch(() => null)) as PublicHlsResponse | null;
      if (!data) return;

      const nextStatus = (data.status || "idle") as PublicHlsResponse["status"];
      setHlsStatus(nextStatus);
      setPlaylistUrl(data.playlistUrl ?? null);

      if (nextStatus === "live") {
        setStatus("live");
        setEnded(false);
      } else if (nextStatus === "starting") {
        setStatus("starting");
      } else if (nextStatus === "error") {
        setStatus("error");
        if (data.error) setError(String(data.error));
      } else {
        // idle
        setStatus("offline");
        if (playlistUrl) setEnded(true);
      }
    } catch {
      // ignore
    } finally {
      setIsRetrying(false);
    }
  }, [roomId, routeRoomId, token, playlistUrl]);

  // Poll loop
  useEffect(() => {
    const currentRoomId = (roomId || routeRoomId || "").trim();
    if (!currentRoomId) return;

    if (looksLikeRoomName(currentRoomId)) {
      setError("HLS must use Firestore roomId, not roomName.");
      setStatus("error");
      return;
    }

    fetchHlsStatus();
    const t = window.setInterval(fetchHlsStatus, 3000);
    return () => window.clearInterval(t);
  }, [roomId, routeRoomId, fetchHlsStatus]);

  // Attach HLS playback:
  // - Safari/iOS: native HLS via video.src
  // - Chrome/Firefox/Edge: hls.js
  useEffect(() => {
    const video = videoRef.current;
    if (!playlistUrl || !video) return;

    // reset state for a fresh attach
    setError(null);

    if (canNativeHls(video)) {
      video.src = playlistUrl;
      video.muted = isMuted;
      void video.play().catch(() => {
        // autoplay might be blocked until user interacts
      });
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(playlistUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = isMuted;
        void video.play().catch(() => {
          // autoplay blocked until user interacts
        });
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data?.fatal) {
          setStatus("error");
          setError("Stream playback error");
          try {
            hls.destroy();
          } catch {
            // ignore
          }
        }
      });

      return () => {
        try {
          hls.destroy();
        } catch {
          // ignore
        }
      };
    } else {
      setStatus("error");
      setError("HLS not supported in this browser.");
    }
  }, [playlistUrl, isMuted]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void v.requestFullscreen();
    }
  };

  const viewerLink = useMemo(() => {
    const id = (roomId || routeRoomId || "").trim();
    if (!id) return "";
    return `${window.location.origin}/live/${encodeURIComponent(id)}${token ? `?t=${encodeURIComponent(token)}` : ""}`;
  }, [roomId, routeRoomId, token]);

  const copyText = async (kind: "viewer" | "playlist", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore
    }
  };

  const StatusBadge = () => {
    const map: Record<StreamStatus, { label: string; dot: string; ring: string; text: string }> = {
      live: { label: "LIVE", dot: "bg-red-500", ring: "border-red-500/60", text: "text-red-300" },
      starting: { label: "STARTING", dot: "bg-amber-500", ring: "border-amber-500/50", text: "text-amber-300" },
      offline: { label: ended ? "ENDED" : "OFFLINE", dot: "bg-neutral-500", ring: "border-neutral-600/50", text: "text-neutral-300" },
      loading: { label: "CONNECTING", dot: "bg-red-500", ring: "border-red-500/40", text: "text-red-300" },
      error: { label: "ERROR", dot: "bg-red-600", ring: "border-red-700/50", text: "text-red-300" },
    };

    const cfg = map[status];

    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 border ${cfg.ring} backdrop-blur-sm`}>
        <div className={`w-2 h-2 rounded-full ${cfg.dot} ${status === "live" || status === "starting" || status === "loading" ? "animate-pulse" : ""}`} />
        <span className={`text-xs font-bold tracking-wider ${cfg.text}`}>{cfg.label}</span>
      </div>
    );
  };

  const TitleText = useMemo(() => {
    if (roomName) return roomName;
    const id = (roomId || routeRoomId || "").trim();
    return id ? `Room: ${id}` : "StreamLine Live";
  }, [roomName, roomId, routeRoomId]);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-red-900/20 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-red-950/30 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: "10s", animationDelay: "2s" }} />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-red-800/10 to-transparent rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg shadow-red-500/20">
  <img
    src={logoUrl}
    alt="StreamLine"
    className="w-full h-full object-contain p-1"
  />
</div>

                <div className="absolute -inset-1 bg-red-500/30 rounded-xl blur-md -z-10" />
              </div>
              <div>
                <div className="text-xl font-bold text-white tracking-tight">StreamLine</div>
                <div className="text-xs text-neutral-500 font-medium">Live Viewer</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Placeholder viewer count (wire later) */}
              {status === "live" && (
                <div className="flex items-center gap-2 text-neutral-400">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">{viewerCount.toLocaleString()}</span>
                </div>
              )}
              <StatusBadge />
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-5xl">
            {/* Info strip */}
            <div className="mb-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-white font-semibold">{TitleText}</div>
                <div className="text-xs text-neutral-500">
                  {ended ? "Stream ended." : status === "live" ? "Watching live" : "Waiting for the host to start HLS"}
                </div>
              </div>

              {role && (
                <div className="text-xs text-neutral-500">
                  Link role: <span className="text-neutral-300 font-semibold">{role}</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <div className="text-sm">{error}</div>
                </div>
              )}
            </div>

            {/* Video frame */}
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500/20 via-transparent to-red-500/10 p-px">
                <div className="w-full h-full rounded-2xl bg-neutral-950/90 backdrop-blur-xl" />
              </div>

              <div className="relative aspect-video bg-black/80 rounded-2xl overflow-hidden border border-neutral-800/50">
                {playlistUrl && status === "live" ? (
                  <>
                    <video ref={videoRef} className="w-full h-full object-contain" autoPlay muted={isMuted} playsInline controls={false} />

                    {/* overlay controls */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-100 md:opacity-0 md:hover:opacity-100 transition-opacity duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={toggleMute}
                            className="p-2 rounded-lg bg-white/10 hover:bg-red-500/30 backdrop-blur-sm transition-colors border border-white/10 hover:border-red-500/50"
                            aria-label="Toggle mute"
                          >
                            {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                          </button>

                          {isMuted && (
                            <span className="text-xs text-neutral-300 bg-black/60 px-2 py-1 rounded border border-neutral-700/50">
                              Click to unmute
                            </span>
                          )}
                        </div>

                        <button
                          onClick={toggleFullscreen}
                          className="p-2 rounded-lg bg-white/10 hover:bg-red-500/30 backdrop-blur-sm transition-colors border border-white/10 hover:border-red-500/50"
                          aria-label="Fullscreen"
                        >
                          <Maximize className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>

                    {/* Live pill */}
                    <div className="absolute top-4 left-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600/95 backdrop-blur-sm shadow-lg shadow-red-500/30">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span className="text-xs font-bold text-white tracking-wider">LIVE</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                    <div className="relative mb-5">
                      <div
                        className={[
                          "w-20 h-20 rounded-2xl flex items-center justify-center border",
                          status === "loading" || status === "starting"
                            ? "bg-gradient-to-br from-red-600/30 to-red-900/30 border-red-500/40"
                            : status === "error"
                            ? "bg-gradient-to-br from-red-900/40 to-red-950/40 border-red-700/40"
                            : "bg-gradient-to-br from-neutral-800/50 to-neutral-900/50 border-neutral-700/30",
                        ].join(" ")}
                      >
                        {status === "loading" || status === "starting" ? (
                          <Signal className={`w-8 h-8 text-red-400 ${isRetrying ? "animate-pulse" : ""}`} />
                        ) : status === "error" ? (
                          <AlertCircle className="w-8 h-8 text-red-500" />
                        ) : (
                          <Radio className="w-8 h-8 text-neutral-500" />
                        )}
                      </div>

                      {(status === "loading" || status === "starting") && (
                        <div className="absolute -inset-2 rounded-2xl border-2 border-red-500/30 animate-ping" />
                      )}
                    </div>

                    <div className="text-xl font-semibold text-white mb-2">
                      {status === "loading" && "Connecting to stream..."}
                      {status === "starting" && "Stream is starting..."}
                      {status === "offline" && (ended ? "Stream ended" : "Stream is offline")}
                      {status === "error" && "Connection Error"}
                    </div>

                    <div className="text-sm text-neutral-500 mb-6 max-w-md">
                      {status === "loading" && "Please wait while we establish a connection."}
                      {status === "starting" && "The broadcaster is preparing to go live."}
                      {status === "offline" && (ended ? "This broadcast has ended." : "This stream isn’t live yet. Check back in a moment.")}
                      {status === "error" && (error || "Unable to connect to the stream.")}
                    </div>

                    <button
                      onClick={fetchHlsStatus}
                      disabled={isRetrying}
                      className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-medium text-sm transition-all duration-300 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
                      {isRetrying ? "Retrying..." : "Retry Connection"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom utility bar */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xs text-neutral-400 flex items-center gap-2">
                  <Signal className="w-4 h-4 text-red-400" />
                  <span className="font-semibold text-neutral-300">HLS Status:</span>
                  <span className="uppercase tracking-wide">{hlsStatus || "idle"}</span>
                </div>
                {playlistUrl && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-xs text-neutral-500 truncate">
                      <span className="text-neutral-400">Playlist:</span> {playlistUrl}
                    </div>
                    <button
                      onClick={() => copyText("playlist", playlistUrl)}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-xs text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied === "playlist" ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xs text-neutral-400 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-red-400" />
                  <span className="font-semibold text-neutral-300">Viewer Link</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-xs text-neutral-500 truncate">{viewerLink || "—"}</div>
                  <button
                    onClick={() => viewerLink && copyText("viewer", viewerLink)}
                    disabled={!viewerLink}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-xs text-white disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied === "viewer" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 text-center text-xs text-neutral-700">
              Powered by <span className="text-red-500 font-medium">StreamLine</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
