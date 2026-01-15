import { useEffect, useMemo, useState } from "react";
import { type DestinationItem } from "../services/destinations";
import { formatLimitLabel } from "../lib/entitlements";
import { API_BASE } from "../lib/apiBase";
import { APP_BASE } from "../lib/appBase";
import CollapsibleSection from "./CollapsibleSection";

type PlatformKey = "youtube" | "facebook" | "twitch" | "custom";

const PLATFORM_CONFIG: Record<PlatformKey, { label: string; accent: string }> = {
  youtube: { label: "YouTube", accent: "#ef4444" },
  facebook: { label: "Facebook", accent: "#3b82f6" },
  twitch: { label: "Twitch", accent: "#a855f7" },
  custom: { label: "Custom RTMP", accent: "#14b8a6" },
};

const MAX_MANUAL_FIELDS = 3;

type PlatformState = {
  selected: boolean;
  manualFields: Array<{ id: string; value: string; base?: string }>;
  error: string | null;
  info: string | null;
};

type EffectiveDestinationPayload = {
  platform: PlatformKey;
  source: "main" | "session";
  streamKey?: string;
  destinationId?: string;
  targetId?: string;
  rtmpUrlBase?: string;
};

const buildDefaultPlatformState = (): Record<PlatformKey, PlatformState> => ({
  youtube: { selected: false, manualFields: [], error: null, info: null },
  facebook: { selected: false, manualFields: [], error: null, info: null },
  twitch: { selected: false, manualFields: [], error: null, info: null },
  custom: { selected: false, manualFields: [], error: null, info: null },
});

type RoomUiSectionKey = "destinations" | "recording" | "layout" | "audio" | "hls";

type RoomUiState = Record<RoomUiSectionKey, boolean>;

const DEFAULT_ROOM_UI_STATE: RoomUiState = {
  destinations: false,
  recording: false,
  layout: false,
  audio: false,
  hls: false,
};

const ROOM_UI_STORAGE_PREFIX = "sl_room_ui_v1";

function getDefaultRtmpBase(p: PlatformKey): string {
  switch (p) {
    case "youtube":
      return "rtmp://a.rtmp.youtube.com/live2";
    case "facebook":
      return "rtmps://live-api-s.facebook.com:443/rtmp/";
    case "twitch":
      return "rtmp://live.twitch.tv/app";
    case "custom":
      return "";
    default:
      return "";
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  roomName: string;
  roomId: string;
  roomAccessToken?: string;
  selectedPresetId?: string;
  defaultLayout?: "speaker" | "grid";
  defaultRecordingMode?: "cloud" | "dual";
  
  // Stream state
  streamStatus: "idle" | "starting" | "live" | "stopping";
  onStartStream: (params: {
    youtubeKey?: string;
    facebookKey?: string;
    twitchKey?: string;
    enabledTargetIds?: string[];
    sessionKeys?: Record<string, { rtmpUrlBase?: string; streamKey?: string }>;
    destinations?: EffectiveDestinationPayload[];
    presetId?: string;
  }) => Promise<void>;
  onStopStream: () => Promise<void>;
  
  // Recording state (independent from stream)
  recordingStatus: "idle" | "recording" | "stopping" | "stopped" | "error";
  onStartRecording: (params: { layout: "speaker" | "grid"; mode: "cloud" | "dual"; presetId?: string }) => Promise<void>;
  onStopRecording: () => Promise<void>;
  recordingEnabled?: boolean;
  recordingElapsedSeconds?: number;
  dualRecordingAllowed?: boolean;
  maxGuests?: number;
  multistreamAllowed?: boolean;

  // Optional: plan + per-clip recording cap (in minutes)
  planId?: string;
  recordingMaxMinutes?: number;

  // Optional: per-platform main destination (already saved)
  savedDestinations?: Array<DestinationItem & { label?: string }>;
}

export default function StreamSetupModalV2({
  open,
  onClose,
  roomName,
  roomId,
  roomAccessToken,
  selectedPresetId,
  defaultLayout = "speaker",
  defaultRecordingMode = "cloud",
  streamStatus,
  onStartStream,
  onStopStream,
  recordingStatus,
  onStartRecording,
  onStopRecording,
  recordingEnabled = true,
  recordingElapsedSeconds = 0,
  dualRecordingAllowed = false,
  maxGuests,
  multistreamAllowed = true,
  planId,
  recordingMaxMinutes,
  savedDestinations,
}: Props) {
  const [destinations, setDestinations] = useState<Array<DestinationItem & { label?: string }>>(savedDestinations || []);
  const [platformState, setPlatformState] = useState<Record<PlatformKey, PlatformState>>(buildDefaultPlatformState);
  const [startError, setStartError] = useState<string | null>(null);
  const [warmupActive, setWarmupActive] = useState(false);
  const [warmupStartedAt, setWarmupStartedAt] = useState<number | null>(null);
  const [warmupPlatforms, setWarmupPlatforms] = useState<PlatformKey[]>([]);
  const [warmupReadyMap, setWarmupReadyMap] = useState<Record<PlatformKey, boolean>>({
    youtube: false,
    facebook: false,
    twitch: false,
    custom: false,
  });
  const [warmupLogged, setWarmupLogged] = useState(false);

  const [roomUiState, setRoomUiState] = useState<RoomUiState>(DEFAULT_ROOM_UI_STATE);

  const [hlsStatus, setHlsStatus] = useState<"idle" | "starting" | "live" | "error">("idle");
  const [hlsPlaylistUrl, setHlsPlaylistUrl] = useState<string | null>(null);
  const [hlsEgressId, setHlsEgressId] = useState<string | null>(null);
  const [hlsError, setHlsError] = useState<string | null>(null);
  const [hlsBusy, setHlsBusy] = useState(false);

  const platformOrder: PlatformKey[] = ["youtube", "facebook", "twitch", "custom"];

  const [layout, setLayout] = useState<"speaker" | "grid">(defaultLayout);
  const [recordingMode, setRecordingMode] = useState<"cloud" | "dual">(defaultRecordingMode);

  // Canonical: HLS is always keyed by Firestore roomId.
  const hlsRoomId = roomId?.trim() || "";

  const looksLikeName =
    hlsRoomId.includes(" ") || hlsRoomId.includes("–") || hlsRoomId.includes("#");

  // HLS controls unlock once we have a canonical Firestore roomId
  // (and not a human-readable name). This matches the host/control-plane
  // contract where everything is keyed by roomId.
  const hlsRoomReady = !!hlsRoomId && !looksLikeName;

  // Keep local layout/mode in sync with defaults from account prefs
  useEffect(() => {
    setLayout(defaultLayout);
  }, [defaultLayout]);

  useEffect(() => {
    setRecordingMode(defaultRecordingMode);
  }, [defaultRecordingMode]);

  useEffect(() => {
    setDestinations(savedDestinations || []);
  }, [savedDestinations]);

  // Load per-room UI state (collapsible sections) from localStorage on first open
  useEffect(() => {
    if (!hlsRoomId) return;
    try {
      const key = `${ROOM_UI_STORAGE_PREFIX}:${hlsRoomId}`;
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        setRoomUiState(DEFAULT_ROOM_UI_STATE);
        return;
      }
      const parsed = JSON.parse(raw) || {};
      const next: RoomUiState = {
        destinations: !!parsed.destinations,
        recording: !!parsed.recording,
        layout: !!parsed.layout,
        audio: !!parsed.audio,
        hls: !!parsed.hls,
      };
      setRoomUiState(next);
    } catch {
      setRoomUiState(DEFAULT_ROOM_UI_STATE);
    }
  }, [hlsRoomId]);

  const updateRoomUiSection = (section: RoomUiSectionKey, open: boolean) => {
    setRoomUiState((prev) => {
      const safePrev = prev || DEFAULT_ROOM_UI_STATE;
      const next: RoomUiState = { ...DEFAULT_ROOM_UI_STATE, ...safePrev, [section]: open };
      try {
        const key = `${ROOM_UI_STORAGE_PREFIX}:${hlsRoomId}`;
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const hlsViewerUrl = hlsRoomId
    ? `${APP_BASE || (typeof window !== "undefined" ? window.location.origin : "")}/live/${encodeURIComponent(
        hlsRoomId
      )}`
    : "";

  // Initial one-shot fetch of HLS status so we can show chip even when collapsed
  useEffect(() => {
    if (!hlsRoomId) return;

    if (looksLikeName) {
      setHlsError("HLS must use Firestore roomId, not roomName.");
      return;
    }
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const url = `${API_BASE}/api/hls/status/${encodeURIComponent(hlsRoomId)}`;
        const headers: Record<string, string> = {};
        if (roomAccessToken) {
          headers["Authorization"] = `Bearer ${roomAccessToken}`;
        }
        const res = await fetch(url, {
          credentials: "include",
          headers,
        });
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) {
            setHlsStatus("idle");
            setHlsPlaylistUrl(null);
            setHlsEgressId(null);
            setHlsError(null);
            return;
          }
          setHlsError("Failed to fetch HLS status");
          return;
        }
        const data: any = await res.json().catch(() => ({}));
        const status = (data?.status as string) || "idle";
        setHlsStatus(status === "starting" || status === "live" || status === "error" ? status : "idle");
        setHlsPlaylistUrl(data?.playlistUrl ?? null);
        setHlsEgressId(data?.egressId ?? null);
        setHlsError(data?.error ?? null);
      } catch {
        if (!cancelled) {
          setHlsError("Failed to fetch HLS status");
        }
      }
    };

    fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [hlsRoomId]);

  // Poll while HLS section is open or status is starting
  useEffect(() => {
    if (!hlsRoomId) return;

    if (looksLikeName) {
      setHlsError("HLS must use Firestore roomId, not roomName.");
      return;
    }

    const shouldPoll = roomUiState.hls || hlsStatus === "starting";
    if (!shouldPoll) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const headers: Record<string, string> = {};
        if (roomAccessToken) {
          headers["Authorization"] = `Bearer ${roomAccessToken}`;
        }
        const res = await fetch(`${API_BASE}/api/hls/status/${encodeURIComponent(hlsRoomId)}`, {
          credentials: "include",
          headers,
        });
        if (cancelled) return;
        if (!res.ok) return;
        const data: any = await res.json().catch(() => ({}));
        const status = (data?.status as string) || "idle";
        setHlsStatus(status === "starting" || status === "live" || status === "error" ? status : "idle");
        setHlsPlaylistUrl(data?.playlistUrl ?? null);
        setHlsEgressId(data?.egressId ?? null);
        setHlsError(data?.error ?? null);
      } catch {
        if (!cancelled) {
          // Soft failure; keep last known status
        }
      }
    };

    poll();
    const id = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hlsRoomId, roomUiState.hls, hlsStatus]);

  const mainByPlatform = useMemo(() => {
    const map: Partial<Record<PlatformKey, DestinationItem>> = {};
    destinations.forEach((d) => {
      const platform = d.platform as PlatformKey;
      if (!platform || !(platform in PLATFORM_CONFIG)) return;
      const current = map[platform];
      const currentPreferred = current ? current.persistent !== false : false;
      const candidatePreferred = d.persistent !== false;
      if (!current) {
        map[platform] = d;
        return;
      }
      if (candidatePreferred && !currentPreferred) {
        map[platform] = d;
        return;
      }
      if ((d.updatedAt || 0) > (current.updatedAt || 0)) {
        map[platform] = d;
      }
    });
    return map;
  }, [destinations]);

  const updatePlatformState = (platform: PlatformKey, partial: Partial<PlatformState>) => {
    setPlatformState((prev) => ({ ...prev, [platform]: { ...prev[platform], ...partial } }));
  };

  useEffect(() => {
    if (!open) {
      // Preserve entered keys across close/reopen within the same session.
      // Only clear transient errors/flags.
      setPlatformState((prev) => {
        const next: Record<PlatformKey, PlatformState> = { ...prev };
        (Object.keys(next) as PlatformKey[]).forEach((p) => {
          next[p] = { ...next[p], error: null, info: null };
        });
        return next;
      });
      setStartError(null);
      setWarmupStartedAt(null);
      setWarmupReadyMap({ youtube: false, facebook: false, twitch: false, custom: false });
      setWarmupLogged(false);
    }
  }, [open]);

  useEffect(() => {
    if (!warmupActive || !warmupStartedAt) return;

    if (streamStatus === "live") {
      const totalMs = Date.now() - warmupStartedAt;
      if (!warmupLogged) {
        const perPlatform: Record<string, number> = {};
        warmupPlatforms.forEach((p) => {
          perPlatform[p] = totalMs;
        });
        console.log("[stream-warmup] egress confirmed running", {
          roomName,
          totalMs,
          totalSeconds: Math.round(totalMs / 1000),
          platforms: warmupPlatforms,
          perPlatformMs: perPlatform,
        });
        setWarmupLogged(true);
      }

      setWarmupReadyMap((prev) => {
        const next = { ...prev };
        warmupPlatforms.forEach((p) => {
          next[p] = true;
        });
        return next;
      });

      // Let the user see "Connected" for a brief moment before clearing
      const timeout = window.setTimeout(() => {
        setWarmupActive(false);
      }, 2000);

      return () => window.clearTimeout(timeout);
    }

    if (streamStatus === "idle") {
      // Stream did not start or was stopped; clear warmup state
      setWarmupActive(false);
    }
  }, [streamStatus, warmupActive, warmupStartedAt, warmupPlatforms, warmupLogged, roomName]);

  if (!open) return null;

  const streamIsLive = streamStatus === "live";
  const streamIsBusy = streamStatus === "starting" || streamStatus === "stopping";
  // When multistreamAllowed is false, the caller has already determined that
  // this user lacks in-room permissions (roomPermissions) to manage streaming.
  const streamDisallowed = !multistreamAllowed;
  
  const recordingIsActive = recordingStatus === "recording";
  const recordingIsBusy = recordingStatus === "stopping";
  // Recording controls are visible when the caller indicates recording is allowed
  // for this session (again based on roomPermissions).
  const showRecordingControls = recordingEnabled !== false;

  const hasRecordingCap = typeof recordingMaxMinutes === "number" && recordingMaxMinutes > 0;

  const badgeItems = [
    { label: "Recording", value: recordingEnabled ? "On" : "Off", ok: recordingEnabled },
    { label: "Dual", value: dualRecordingAllowed ? "On" : "Off", ok: dualRecordingAllowed },
    { label: "Multistream", value: multistreamAllowed ? "On" : "Off", ok: multistreamAllowed },
    typeof maxGuests === "number"
      ? {
          label: "Guests",
          value: formatLimitLabel(maxGuests, "guest"),
          ok: maxGuests !== 0,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string; ok: boolean }>;

  const selectedPlatforms = platformOrder.filter((p) => platformState[p].selected);
  const missingKeySelected = selectedPlatforms.some((p) => {
    const main = mainByPlatform[p];
    const mainUsable = !!(main && main.hasKey && main.mode !== "connected");
    const manual = platformState[p].manualFields.find((f) => f.value.trim());
    return !(mainUsable || manual);
  });
  const startDisabled = streamIsBusy || streamDisallowed || selectedPlatforms.length === 0 || missingKeySelected || warmupActive;

  const handleStartHls = async () => {
    if (!hlsRoomId) return;
    if (hlsStatus === "starting" || hlsStatus === "live") return;
    setHlsBusy(true);
    setHlsError(null);
    setHlsStatus("starting");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (roomAccessToken) {
        headers["Authorization"] = `Bearer ${roomAccessToken}`;
      }
      const res = await fetch(`${API_BASE}/api/hls/start/${encodeURIComponent(hlsRoomId)}`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ presetId: "hls_720p" }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHlsStatus("error");
        setHlsError(data?.error || "Failed to start HLS");
        return;
      }
      const status = (data?.status as string) || "live";
      setHlsStatus(status === "starting" || status === "live" || status === "error" ? status : "live");
      setHlsPlaylistUrl(data?.playlistUrl ?? null);
      setHlsEgressId(data?.egressId ?? null);
      setHlsError(null);
    } catch (err: any) {
      setHlsStatus("error");
      setHlsError(err?.message || "Failed to start HLS");
    } finally {
      setHlsBusy(false);
    }
  };

  const handleStopHls = async () => {
    if (!hlsRoomId) return;
    if (hlsStatus === "idle") return;
    setHlsBusy(true);
    try {
      const headers: Record<string, string> = {};
      if (roomAccessToken) {
        headers["Authorization"] = `Bearer ${roomAccessToken}`;
      }
      const res = await fetch(`${API_BASE}/api/hls/stop/${encodeURIComponent(hlsRoomId)}`, {
        method: "POST",
        headers,
        credentials: "include",
      });
      if (!res.ok) {
        const data: any = await res.json().catch(() => ({}));
        setHlsError(data?.error || "Failed to stop HLS");
        return;
      }
      setHlsStatus("idle");
      setHlsError(null);
      // playlistUrl may remain for debugging; UI only exposes when live
    } catch (err: any) {
      setHlsError(err?.message || "Failed to stop HLS");
    } finally {
      setHlsBusy(false);
    }
  };

  const handleStartStream = async () => {
    if (streamDisallowed) {
      alert("You don't have permission to start streaming in this room.");
      return;
    }
    const sessionKeyPayload: Record<string, { rtmpUrlBase?: string; streamKey?: string }> = {};
    const enabledTargetIds: string[] = [];
    const effectiveDestinations: EffectiveDestinationPayload[] = [];
    let youtubeKey: string | undefined;
    let facebookKey: string | undefined;
    let twitchKey: string | undefined;

    let hasSelection = false;
    let hasErrors = false;
    setStartError(null);

    const nextPlatformState = { ...platformState };

    platformOrder.forEach((platform) => {
      const state = platformState[platform];
      nextPlatformState[platform] = { ...state, error: null, info: state.info };
      if (!state.selected) return;
      hasSelection = true;

      const main = mainByPlatform[platform];
      const mainUsable = !!(main && main.hasKey && main.mode !== "connected");
      const manualField = state.manualFields.find((f) => f.value.trim());
      let sessionKey = manualField?.value.trim() || "";
      const customBase = manualField?.base?.trim();
      const hasKey = mainUsable || !!sessionKey;
      const targetId = main?.targetId || main?.id;
      let rtmpBase = customBase || main?.rtmpUrlBase || getDefaultRtmpBase(platform);

      // Allow a full RTMP URL in the key box (base optional for custom)
      if (platform === "custom" && !rtmpBase && sessionKey) {
        const idx = sessionKey.lastIndexOf("/");
        const maybeProto = sessionKey.slice(0, idx);
        if (idx > 8 && maybeProto.startsWith("rtmp")) {
          const fullBase = sessionKey.slice(0, idx);
          const tailKey = sessionKey.slice(idx + 1);
          if (fullBase && tailKey) {
            rtmpBase = fullBase;
            sessionKey = tailKey;
          }
        }
      }

      if (platform === "custom") {
        if (!sessionKey) {
          nextPlatformState[platform].error = "Add a stream key (or full RTMP URL).";
          hasErrors = true;
          return;
        }
        // Base URL is optional; will be parsed from full RTMP if provided, otherwise handled server-side.
      }

      if (platform === "custom" && !rtmpBase) {
        nextPlatformState[platform].error = "Base RTMP URL required.";
        hasErrors = true;
        return;
      }

      if (!hasKey) {
        nextPlatformState[platform].error = "No stream key set.";
        hasErrors = true;
        return;
      }

      effectiveDestinations.push({
        platform,
        source: sessionKey ? "session" : "main",
        streamKey: sessionKey || undefined,
        destinationId: main?.id,
        targetId,
        rtmpUrlBase: rtmpBase,
      });

      if (mainUsable && main) {
        enabledTargetIds.push(main.id);
        if (sessionKey) {
          sessionKeyPayload[targetId || main.id] = {
            rtmpUrlBase: rtmpBase,
            streamKey: sessionKey,
          };
        }
      } else if (sessionKey) {
        if (platform === "youtube") youtubeKey = sessionKey;
        if (platform === "facebook") facebookKey = sessionKey;
        if (platform === "twitch") twitchKey = sessionKey;
      }
    });

    setPlatformState(nextPlatformState);

    if (!hasSelection) {
      setStartError("Pick at least one platform to stream to.");
      return;
    }

    if (hasErrors) {
      setStartError("Fix the highlighted platforms before starting.");
      return;
    }

    try {
      const now = Date.now();
      const platformsNow = selectedPlatforms;
      setWarmupActive(true);
      setWarmupStartedAt(now);
      setWarmupPlatforms(platformsNow);
      setWarmupReadyMap({ youtube: false, facebook: false, twitch: false, custom: false });
      setWarmupLogged(false);

      await onStartStream({
        youtubeKey,
        facebookKey,
        twitchKey,
        enabledTargetIds: enabledTargetIds.length ? enabledTargetIds : undefined,
        sessionKeys: Object.keys(sessionKeyPayload).length ? sessionKeyPayload : undefined,
        destinations: effectiveDestinations,
        presetId: selectedPresetId,
      });
    } catch (err: any) {
      setStartError(err?.message || String(err));
      setWarmupActive(false);
    }
  };

  const handleStartRecording = async () => {
    await onStartRecording({ layout, mode: recordingMode, presetId: selectedPresetId });
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      zIndex: 50,
      pointerEvents: 'auto'
    }}>
      {/* Floating Menu Card */}
      <div style={{
        background: 'rgba(20, 20, 20, 0.98)',
        borderRadius: '0.75rem',
        border: '1px solid rgba(220, 38, 38, 0.5)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px rgba(220, 38, 38, 0.2)',
        width: '380px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        color: '#ffffff'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem',
          borderBottom: '2px solid rgba(220, 38, 38, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(239, 68, 68, 0.05))'
        }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#ef4444', letterSpacing: '0.5px' }}>
              STREAM CONTROL
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.25rem' }}>
              Stream & Recording are independent
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={streamIsBusy || recordingIsBusy}
            style={{
              background: 'rgba(220, 38, 38, 0.2)',
              border: '1px solid rgba(220, 38, 38, 0.5)',
              borderRadius: '0.375rem',
              color: '#ef4444',
              padding: '0.4rem 0.6rem',
              cursor: (streamIsBusy || recordingIsBusy) ? 'not-allowed' : 'pointer',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              transition: 'all 0.3s ease',
              fontWeight: 'bold',
              opacity: (streamIsBusy || recordingIsBusy) ? 0.5 : 1
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>

          {/* Features Panel (constant, always visible) */}
          {badgeItems.length > 0 && (
            <div style={{
              borderRadius: '0.75rem',
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'radial-gradient(circle at top left, rgba(248,113,113,0.3), rgba(15,23,42,0.95))',
              padding: '0.75rem 0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#e5e7eb' }}>
                  Features Panel
                </div>
                {planId && (
                  <div style={{
                    fontSize: '0.7rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '999px',
                    background: 'rgba(15,23,42,0.85)',
                    border: '1px solid rgba(148,163,184,0.6)',
                    color: '#cbd5f5'
                  }}>
                    Plan: {planId}
                  </div>
                )}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '0.5rem'
              }}>
                {badgeItems.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      border: `1px solid ${item.ok ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
                      background: item.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.09)',
                      color: item.ok ? '#bbf7d0' : '#fecdd3',
                      borderRadius: '0.6rem',
                      padding: '0.4rem 0.55rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem',
                      minHeight: '52px'
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', opacity: 0.78 }}>{item.label}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 1: STREAM PLATFORMS */}
          <CollapsibleSection
            id="destinations"
            title="Destinations / Platforms"
            defaultOpen={roomUiState.destinations}
            onToggle={(open) => updateRoomUiSection("destinations", open)}
          >
          <div style={{
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '0.5rem',
            padding: '0.75rem'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#3b82f6', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              📡 Stream Destinations
            </div>

            {streamDisallowed && (
              <div style={{
                marginBottom: '0.75rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.375rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                fontSize: '0.75rem',
                color: '#fca5a5'
              }}>
                Multistream is disabled for this plan. Upgrade in Settings → Usage to enable streaming to external destinations.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {platformOrder.map((platform) => {
                const config = PLATFORM_CONFIG[platform];
                const main = mainByPlatform[platform];
                const state = platformState[platform];
                const mainHasKey = !!(main && main.hasKey);
                const disabled = streamIsLive || streamIsBusy || streamDisallowed;
                const connectedMode = false;
                const mainPreview = main?.hasKey && main?.keyPreview ? ` • ••••${main.keyPreview}` : main?.hasKey ? "" : "";
                const manualLabel = platform === "custom" ? "Custom stream key" : "Session stream key (this stream only)";
                const manualMissing = state.selected && !mainHasKey && !state.manualFields.find((f) => f.value.trim());
                const manualLimitReached = state.manualFields.length >= MAX_MANUAL_FIELDS;

                return (
                  <div
                    key={platform}
                    style={{
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '0.6rem',
                      padding: '0.6rem 0.7rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: config.accent }}>{config.label}</span>
                        {main && (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            border: '1px solid rgba(165,180,252,0.35)',
                            background: 'rgba(64, 156, 104, 0.46)',
                            fontSize: '0.75rem',
                            color: '#52e625ff'
                          }}>
                            {main.status}{mainPreview}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)' }}>
                          <input
                            type="checkbox"
                            checked={state.selected}
                            onChange={() => updatePlatformState(platform, { selected: !state.selected, error: null, info: null })}
                            disabled={disabled || connectedMode}
                            style={{ cursor: (disabled || connectedMode) ? 'not-allowed' : 'pointer', accentColor: config.accent, width: 16, height: 16 }}
                          />
                          Enabled
                        </label>
                        <button
                          onClick={() => {
                            const fieldId = `${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                            const nextFields = [...state.manualFields, { id: fieldId, value: "", base: "" }];
                            updatePlatformState(platform, { manualFields: nextFields, error: null });
                          }}
                          disabled={disabled || manualLimitReached}
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.4rem',
                            border: '1px solid rgba(59,130,246,0.4)',
                            background: manualLimitReached ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
                            color: '#bfdbfe',
                            fontWeight: 600,
                            cursor: (disabled || manualLimitReached) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    {!main && (
                      <div style={{ fontSize: '0.75rem', color: 'rgba(226,232,240,0.7)' }}>
                        No main key saved. Add one in Settings to reuse across sessions.
                      </div>
                    )}

                    {state.manualFields.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {state.manualFields.map((field) => (
                          <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input
                                type="text"
                                value={field.value}
                                onChange={(e) => {
                                  const nextFields = state.manualFields.map((f) => (f.id === field.id ? { ...f, value: e.target.value } : f));
                                  updatePlatformState(platform, { manualFields: nextFields, error: null });
                                }}
                                placeholder={manualLabel}
                                disabled={streamIsLive || streamDisallowed}
                                style={{
                                  flex: 1,
                                  padding: '0.45rem 0.55rem',
                                  background: 'rgba(31, 41, 55, 0.7)',
                                  border: '1px solid rgba(75, 85, 99, 0.5)',
                                  borderRadius: '0.35rem',
                                  color: '#ffffff',
                                  fontSize: '0.8rem',
                                  outline: 'none',
                                  opacity: (streamIsLive || streamDisallowed) ? 0.5 : 1
                                }}
                              />
                              <button
                                onClick={() => {
                                  const nextFields = state.manualFields.filter((f) => f.id !== field.id);
                                  updatePlatformState(platform, { manualFields: nextFields, error: null });
                                }}
                                disabled={streamIsLive || streamDisallowed}
                                style={{
                                  padding: '0.25rem 0.35rem',
                                  borderRadius: '0.35rem',
                                  border: '1px solid rgba(239,68,68,0.6)',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#fca5a5',
                                  cursor: (streamIsLive || streamDisallowed) ? 'not-allowed' : 'pointer',
                                  fontSize: '0.75rem'
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            {platform === 'custom' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input
                                  type="text"
                                  value={field.base || ''}
                                  onChange={(e) => {
                                    const nextFields = state.manualFields.map((f) => (f.id === field.id ? { ...f, base: e.target.value } : f));
                                    updatePlatformState(platform, { manualFields: nextFields, error: null });
                                  }}
                                  placeholder="Optional base RTMP URL"
                                  disabled={streamIsLive || streamDisallowed}
                                  style={{
                                    flex: 1,
                                    padding: '0.4rem 0.5rem',
                                    background: 'rgba(31, 41, 55, 0.55)',
                                    border: '1px solid rgba(75, 85, 99, 0.4)',
                                    borderRadius: '0.3rem',
                                    color: '#ffffff',
                                    fontSize: '0.78rem',
                                    outline: 'none',
                                    opacity: (streamIsLive || streamDisallowed) ? 0.5 : 1
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                        {!main && (
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                            Session-only. Not saved or promoted to main.
                          </div>
                        )}
                        {manualLimitReached && (
                          <div style={{ fontSize: '0.72rem', color: '#fca5a5' }}>
                            Limit reached: remove a session key to add another (max 3).
                          </div>
                        )}
                      </div>
                    )}

                    {manualMissing && (
                      <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                        No stream key set.
                      </div>
                    )}
                    {state.error && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#fca5a5',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '0.35rem',
                        padding: '0.35rem 0.45rem'
                      }}>
                        {state.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              {(streamStatus === "idle" || streamStatus === "starting") ? (
                <>
                  <button
                    onClick={handleStartStream}
                    disabled={startDisabled}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.5rem',
                      background: startDisabled ? 'rgba(59, 130, 246, 0.35)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: '600',
                      cursor: startDisabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {streamStatus === "starting" || warmupActive ? "🔄 Connecting…" : "📡 Go Live"}
                  </button>
                  {startError && (
                    <div style={{
                      marginTop: '0.55rem',
                      fontSize: '0.75rem',
                      color: '#fca5a5',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: '0.4rem',
                      padding: '0.4rem 0.5rem'
                    }}>
                      {startError}
                    </div>
                  )}
                  {warmupActive && warmupPlatforms.length > 0 && (
                    <div style={{
                      marginTop: '0.6rem',
                      padding: '0.6rem 0.7rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(15,23,42,0.85)',
                      border: '1px solid rgba(148,163,184,0.4)',
                      fontSize: '0.75rem',
                      color: '#e5e7eb',
                    }}>
                      <div style={{ marginBottom: '0.4rem', fontWeight: 600 }}>
                        {(() => {
                          const facebookSelected = warmupPlatforms.includes("facebook");
                          const primaryKey: PlatformKey = (facebookSelected
                            ? "facebook"
                            : warmupPlatforms[0]) as PlatformKey;
                          const primaryConfig = PLATFORM_CONFIG[primaryKey];
                          const primaryLabel = primaryConfig?.label || "your destinations";
                          return `Connecting to ${primaryLabel}… this usually takes 5–10 seconds.`;
                        })()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        {warmupPlatforms.map((p) => {
                          const config = PLATFORM_CONFIG[p as PlatformKey] || { label: p, accent: '#e5e7eb' };
                          const ready = warmupReadyMap[p];
                          return (
                            <div
                              key={p}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span style={{ color: config.accent, fontWeight: 600 }}>{config.label}</span>
                              <span style={{ fontFamily: 'monospace' }}>
                                {ready ? '✓ Connected' : '… Connecting'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={onStopStream}
                  disabled={streamIsBusy}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '0.5rem',
                    background: streamIsBusy ? 'rgba(239, 68, 68, 0.5)' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '600',
                    cursor: streamIsBusy ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {streamStatus === "stopping" ? "🔄 Stopping Stream..." : "⏹️ Stop Stream"}
                </button>
              )}
            </div>
          </div>
          </CollapsibleSection>

          {/* SECTION 2: RECORDING CONTROL */}
          {showRecordingControls && (
            <CollapsibleSection
              id="recording"
              title="Recording settings"
              defaultOpen={roomUiState.recording}
              onToggle={(open) => updateRoomUiSection("recording", open)}
            >
            <div style={{
              background: 'rgba(220, 38, 38, 0.05)',
              border: '1px solid rgba(220, 38, 38, 0.2)',
              borderRadius: '0.5rem',
              padding: '0.75rem'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#ef4444', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                🎬 Recording Control
              </div>

              {/* Mode Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Mode:</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setRecordingMode('cloud')}
                    disabled={recordingIsActive}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: '0.35rem',
                      border: recordingMode === 'cloud' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.15)',
                      background: recordingMode === 'cloud' ? 'rgba(239, 68, 68, 0.12)' : '#18181b',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: recordingIsActive ? 'not-allowed' : 'pointer',
                      opacity: recordingIsActive ? 0.5 : 1,
                    }}
                  >
                    Cloud
                  </button>
                  <button
                    onClick={() => dualRecordingAllowed && setRecordingMode('dual')}
                    disabled={recordingIsActive || !dualRecordingAllowed}
                    title={dualRecordingAllowed ? 'Record cloud + local copy' : 'Dual recording not included in this plan'}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: '0.35rem',
                      border: recordingMode === 'dual' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.15)',
                      background: recordingMode === 'dual' ? 'rgba(239, 68, 68, 0.12)' : '#18181b',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: (recordingIsActive || !dualRecordingAllowed) ? 'not-allowed' : 'pointer',
                      opacity: !dualRecordingAllowed ? 0.4 : (recordingIsActive ? 0.6 : 1),
                    }}
                  >
                    Dual
                  </button>
                </div>
                {!dualRecordingAllowed && (
                  <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                    Dual recording is disabled for this plan.
                  </div>
                )}
              </div>

              {/* Layout Selector */}
              <label style={{ fontSize: '0.875rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: 600 }}>Layout:</span>
                <select
                  value={layout}
                  onChange={e => setLayout(e.target.value as "speaker" | "grid")}
                  disabled={recordingIsActive}
                  style={{
                    padding: '0.4rem 0.7rem',
                    borderRadius: '0.3rem',
                    border: '1px solid #ef4444',
                    background: '#18181b',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: recordingIsActive ? 'not-allowed' : 'pointer',
                    opacity: recordingIsActive ? 0.5 : 1
                  }}
                >
                  <option value="speaker">Speaker</option>
                  <option value="grid">Grid</option>
                </select>
              </label>

              {/* Status */}
              {recordingStatus === "error" && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#ef4444', 
                  marginBottom: '0.75rem',
                  padding: '0.5rem',
                  background: 'rgba(220, 38, 38, 0.1)',
                  borderRadius: '0.25rem'
                }}>
                  ❌ Recording failed to start. Check server logs.
                </div>
              )}

              {/* Recording Control Button */}
              {!recordingIsActive ? (
                <button
                  onClick={handleStartRecording}
                  disabled={recordingIsBusy || (recordingMode === "dual" && !dualRecordingAllowed)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '0.5rem',
                    background: recordingIsBusy ? 'rgba(220, 38, 38, 0.3)' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '600',
                    cursor: (recordingIsBusy || (recordingMode === "dual" && !dualRecordingAllowed)) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: (recordingIsBusy || (recordingMode === "dual" && !dualRecordingAllowed)) ? 0.6 : 1
                  }}
                >
                  🎬 Start Recording
                </button>
              ) : (
                <button
                  onClick={onStopRecording}
                  disabled={recordingIsBusy}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '0.5rem',
                    background: recordingIsBusy ? 'rgba(220, 38, 38, 0.5)' : 'linear-gradient(135deg, #7c2d12, #991b1b)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '600',
                    cursor: recordingIsBusy ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {recordingIsBusy ? "🔄 Stopping Recording..." : "⏹️ Stop Recording"}
                </button>
              )}

              {recordingIsActive && (
                <div style={{
                  marginTop: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#ef4444'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    Recording in progress…
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '0.35rem',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      fontFamily: 'monospace',
                      color: '#fecaca'
                    }}>
                      {hasRecordingCap
                        ? `${Math.floor(recordingElapsedSeconds / 60)}:${String(recordingElapsedSeconds % 60).padStart(2, '0')} / ${String(recordingMaxMinutes).padStart(2, '0')}:00`
                        : `${Math.floor(recordingElapsedSeconds / 60)}:${String(recordingElapsedSeconds % 60).padStart(2, '0')}`}
                    </span>
                    {hasRecordingCap && (
                      <span style={{
                        marginLeft: '0.4rem',
                        padding: '2px 6px',
                        borderRadius: '0.35rem',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(148, 163, 184, 0.5)',
                        fontSize: '0.7rem',
                        color: 'rgba(226, 232, 240, 0.9)'
                      }}>
                        Clip cap: {recordingMaxMinutes} min
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
            </CollapsibleSection>
          )}

          {/* HLS Broadcast section (collapsible) */}
          <CollapsibleSection
            id="hls"
            title="HLS Broadcast"
            defaultOpen={roomUiState.hls}
            onToggle={(open) => updateRoomUiSection("hls", open)}
            rightBadge={(
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  background:
                    hlsStatus === 'live'
                      ? 'rgba(220,38,38,0.16)'
                      : hlsStatus === 'starting'
                      ? 'rgba(234,179,8,0.16)'
                      : hlsStatus === 'error'
                      ? 'rgba(248,113,113,0.16)'
                      : 'rgba(31,41,55,0.9)',
                  border:
                    hlsStatus === 'live'
                      ? '1px solid rgba(220,38,38,0.7)'
                      : hlsStatus === 'starting'
                      ? '1px solid rgba(234,179,8,0.7)'
                      : hlsStatus === 'error'
                      ? '1px solid rgba(248,113,113,0.7)'
                      : '1px solid rgba(148,163,184,0.6)',
                  color:
                    hlsStatus === 'live'
                      ? '#fecaca'
                      : hlsStatus === 'starting'
                      ? '#facc15'
                      : hlsStatus === 'error'
                      ? '#fecaca'
                      : '#e5e7eb',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '999px',
                    backgroundColor:
                      hlsStatus === 'live'
                        ? '#ef4444'
                        : hlsStatus === 'starting'
                        ? '#eab308'
                        : hlsStatus === 'error'
                        ? '#f97373'
                        : '#6b7280',
                  }}
                />
                <span>{hlsStatus === 'idle' ? 'Idle' : hlsStatus === 'starting' ? 'Starting' : hlsStatus === 'live' ? 'Live' : 'Error'}</span>
              </span>
            )}
          >
            <div style={{ fontSize: '0.75rem', color: 'rgba(209, 213, 219, 0.9)', marginBottom: '0.65rem' }}>
              {!hlsRoomReady
                ? 'Loading room… HLS controls will unlock once the Firestore roomId is known.'
                : 'Start HLS to create a public watch link. Viewers can watch without joining the room.'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.6rem' }}>
              {/* Direct playlist URL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Direct HLS Playlist URL</span>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    readOnly
                    value={hlsStatus === 'live' && hlsPlaylistUrl ? hlsPlaylistUrl : ''}
                    placeholder={hlsStatus === 'live' ? 'Waiting for playlist URL…' : 'Playlist available when HLS is live'}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.55rem',
                      borderRadius: '0.35rem',
                      border: '1px solid rgba(75,85,99,0.7)',
                      background: 'rgba(15,23,42,0.9)',
                      color: '#e5e7eb',
                      fontSize: '0.8rem',
                    }}
                  />
                  <button
                    type="button"
                    disabled={!(hlsStatus === 'live' && hlsPlaylistUrl)}
                    onClick={async () => {
                      if (!(hlsStatus === 'live' && hlsPlaylistUrl)) return;
                      try {
                        await navigator.clipboard.writeText(hlsPlaylistUrl);
                        alert('Playlist URL copied');
                      } catch {/* ignore */}
                    }}
                    style={{
                      padding: '0.35rem 0.6rem',
                      borderRadius: '0.35rem',
                      border: '1px solid rgba(148,163,184,0.7)',
                      background: 'rgba(15,23,42,0.95)',
                      color: '#e5e7eb',
                      fontSize: '0.75rem',
                      cursor: hlsStatus === 'live' && hlsPlaylistUrl ? 'pointer' : 'not-allowed',
                      opacity: hlsStatus === 'live' && hlsPlaylistUrl ? 1 : 0.5,
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

            </div>

            {hlsError && hlsStatus === 'error' && (
              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#fecaca',
                  background: 'rgba(248,113,113,0.1)',
                  border: '1px solid rgba(248,113,113,0.6)',
                  borderRadius: '0.4rem',
                  padding: '0.4rem 0.5rem',
                }}
              >
                ❌ {hlsError}
              </div>
            )}

            <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleStartHls}
                disabled={!hlsRoomReady || hlsBusy || !(hlsStatus === 'idle' || hlsStatus === 'error')}
                style={{
                  flex: 1,
                  padding: '0.6rem 0.7rem',
                  borderRadius: '0.45rem',
                  border: 'none',
                  background:
                    !hlsRoomReady || hlsBusy || !(hlsStatus === 'idle' || hlsStatus === 'error')
                      ? 'rgba(37,99,235,0.4)'
                      : 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor:
                    !hlsRoomReady || hlsBusy || !(hlsStatus === 'idle' || hlsStatus === 'error') ? 'not-allowed' : 'pointer',
                  opacity:
                    !hlsRoomReady || hlsBusy || !(hlsStatus === 'idle' || hlsStatus === 'error') ? 0.6 : 1,
                }}
              >
                {hlsBusy && (hlsStatus === 'starting' || hlsStatus === 'idle')
                  ? 'Starting HLS…'
                  : 'Start HLS'}
              </button>
              <button
                type="button"
                onClick={handleStopHls}
                disabled={hlsBusy || !(hlsStatus === 'live' || hlsStatus === 'starting')}
                style={{
                  flex: 1,
                  padding: '0.6rem 0.7rem',
                  borderRadius: '0.45rem',
                  border: 'none',
                  background:
                    hlsBusy || !(hlsStatus === 'live' || hlsStatus === 'starting')
                      ? 'rgba(248,113,113,0.35)'
                      : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor:
                    hlsBusy || !(hlsStatus === 'live' || hlsStatus === 'starting') ? 'not-allowed' : 'pointer',
                  opacity:
                    hlsBusy || !(hlsStatus === 'live' || hlsStatus === 'starting') ? 0.6 : 1,
                }}
              >
                {hlsBusy && (hlsStatus === 'live' || hlsStatus === 'starting')
                  ? 'Stopping HLS…'
                  : 'Stop HLS'}
              </button>
            </div>
          </CollapsibleSection>

          {/* Help Text */}
          <div style={{ 
            fontSize: '0.7rem', 
            color: 'rgba(255, 255, 255, 0.4)', 
            lineHeight: 1.4,
            fontStyle: 'italic'
          }}>
            💡 Tip: You can stream without recording, or record without streaming to platforms. They're independent!
            {typeof maxGuests === "number" && maxGuests > 0 && (
              <div style={{ marginTop: '0.3rem', color: 'rgba(255, 255, 255, 0.55)', fontStyle: 'normal' }}>
                Plan guest limit: {maxGuests}.
              </div>
            )}
            {hasRecordingCap && (
              <div style={{ marginTop: '0.3rem', color: 'rgba(148, 163, 184, 0.9)', fontStyle: 'normal' }}>
                Per-clip cap: {recordingMaxMinutes}-minute maximum per recording.
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}