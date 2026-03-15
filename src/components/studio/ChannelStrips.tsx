import { useRef, useEffect, useState, useCallback } from "react";
import { Upload, GripVertical } from "lucide-react";
import RotaryKnob from "./RotaryKnob";
import VUMeter from "./VUMeter";
import { useStudioStore } from "@/studio/engine/studioStore";
import { mixerEngine } from "@/audio/MixerEngine";
import { trackTypeConfig, trackColorPalette } from "@/studio/types/studio";

const ChannelStrips = () => {
  const tracks = useStudioStore((s) => s.tracks);
  const mixerChannels = useStudioStore((s) => s.mixerChannels);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const isRecording = useStudioStore((s) => s.isRecording);
  const updateTrack = useStudioStore((s) => s.updateTrack);
  const updateMixerChannel = useStudioStore((s) => s.updateMixerChannel);
  const reorderTrack = useStudioStore((s) => s.reorderTrack);
  const addSource = useStudioStore((s) => s.addSource);
  const addClip = useStudioStore((s) => s.addClip);
  const addTrack = useStudioStore((s) => s.addTrack);
  const moveTrackToBus = useStudioStore((s) => s.moveTrackToBus);
  const pushUndo = useStudioStore((s) => s.pushUndo);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTargetTrackRef = useRef<string | null>(null);

  const audioActive = isPlaying || isRecording;

  // Drag state for reorder
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) {
      reorderTrack(tracks[dragIdx].id, idx);
    }
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, tracks, reorderTrack]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  // Poll real mixer levels per track
  const [trackLevels, setTrackLevels] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!audioActive) {
      setTrackLevels({});
      return;
    }
    let raf: number;
    const poll = () => {
      const levels: Record<string, number> = {};
      for (const t of useStudioStore.getState().tracks) {
        levels[t.id] = mixerEngine.getLevel(t.id);
      }
      setTrackLevels(levels);
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [audioActive]);

  const importAudio = useCallback(async (file: File, trackId?: string) => {
    if (!file.type.startsWith("audio/")) return;

    const url = URL.createObjectURL(file);

    let duration = 0;
    try {
      const arrayBuf = await file.arrayBuffer();
      const audioCtx = new AudioContext();
      const decoded = await audioCtx.decodeAudioData(arrayBuf);
      duration = decoded.duration;
      audioCtx.close();
    } catch {
      duration = 30;
    }

    const sourceId = addSource({ name: file.name, file, url, duration });

    let targetTrackId = trackId;
    const hasTrack = targetTrackId
      ? useStudioStore.getState().tracks.some((t) => t.id === targetTrackId)
      : false;

    if (!targetTrackId || !hasTrack) {
      const trackName = file.name.replace(/\.[^.]+$/, "");
      targetTrackId = addTrack("audio", trackName);
    }

    const bpm = useStudioStore.getState().bpm;
    const durationInBeats = duration * (bpm / 60);

    addClip({
      trackId: targetTrackId,
      sourceId,
      start: 0,
      end: durationInBeats,
      offset: 0,
      name: file.name,
    });
  }, [addSource, addTrack, addClip]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    pushUndo();
    const importTrackId = importTargetTrackRef.current ?? undefined;

    for (const file of Array.from(files)) {
      await importAudio(file, importTrackId);
    }

    importTargetTrackRef.current = null;
    e.target.value = "";
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ trackId?: string }>;
      importTargetTrackRef.current = customEvent.detail?.trackId ?? null;
      fileInputRef.current?.click();
    };
    window.addEventListener("studio:import-audio", handler);
    return () => window.removeEventListener("studio:import-audio", handler);
  }, []);

  // Bus tracks for routing display
  const busTracks = tracks.filter((t) => t.type === "bus");

  return (
    <div className="studio-panel flex flex-col gap-0 w-[260px] shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-studio-text-dim">
          Mixer
        </span>
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider text-studio-teal hover:bg-studio-metal transition-colors"
            title="Import audio file"
          >
            <Upload className="w-3 h-3" />
            Import
          </button>
          <div className="studio-screw" />
          <div className="studio-screw" />
        </div>
      </div>

      {/* Channels — scrollable when there are more tracks than fit */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full" style={{ minWidth: tracks.length * 56 }}>
        {tracks.map((track, idx) => {
          const ch = mixerChannels.find((c) => c.id === track.channelId);
          const volume = ch?.volume ?? 0.75;
          const muted = ch?.mute ?? false;
          const soloed = ch?.solo ?? false;
          const color = track.color ?? trackTypeConfig[track.type]?.defaultColor ?? "hsl(220 15% 60%)";
          const typeConf = trackTypeConfig[track.type];
          const isDragOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
          return (
            <div
              key={track.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`flex flex-col items-center py-3 gap-2 border-r border-border last:border-r-0 relative transition-all ${
                dragIdx === idx ? "opacity-40" : ""
              } ${isDragOver ? "bg-studio-teal/5 border-l-2 border-l-studio-teal" : ""}`}
              style={{
                minWidth: 56,
                flex: "1 0 56px",
                background: track.armed && !isDragOver
                  ? `linear-gradient(180deg, hsl(0 100% 62% / 0.03), transparent)`
                  : undefined,
              }}
            >
              {/* Drag handle */}
              <GripVertical className="w-3 h-3 text-studio-text-dim/40 cursor-grab active:cursor-grabbing shrink-0" />

              {/* Track type badge */}
              <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-studio-metal" style={{ color }}>
                {typeConf?.icon} {typeConf?.label ?? track.type}
              </span>

              {/* Track name */}
              <span
                className="text-[9px] font-semibold uppercase tracking-wider text-center leading-tight max-w-[52px] truncate"
                style={{ color }}
                title={track.name}
              >
                {track.name}
              </span>

              {/* Bus routing indicator / selector */}
              {track.type !== "bus" && track.type !== "master" && busTracks.length > 0 && (
                <select
                  value={track.busId ?? ""}
                  onChange={(e) => moveTrackToBus(track.id, e.target.value || undefined)}
                  className="w-[48px] text-[7px] bg-studio-metal text-studio-text-dim border border-border rounded px-0.5 py-0.5 uppercase tracking-wider truncate cursor-pointer hover:border-studio-teal/50 transition-colors"
                  title={track.busId ? `Routed to ${tracks.find((t) => t.id === track.busId)?.name ?? "bus"}` : "No bus routing"}
                >
                  <option value="">Direct</option>
                  {busTracks.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      → {bus.name}
                    </option>
                  ))}
                </select>
              )}
              {track.type === "bus" && (
                <span className="text-[6px] text-studio-teal uppercase tracking-wider font-bold">
                  BUS
                </span>
              )}

              {/* Record arm */}
              <button
                className="flex flex-col items-center gap-0.5"
                onClick={() => updateTrack(track.id, { armed: !track.armed })}
              >
                <div
                  className={`w-2 h-2 rounded-full transition-all ${
                    track.armed
                      ? "bg-studio-record shadow-[0_0_8px_hsl(0_100%_62%/0.5)] animate-record-pulse"
                      : "bg-studio-metal-light"
                  }`}
                />
                <span className="text-[7px] text-studio-text-dim uppercase">Rec</span>
              </button>

              {/* Mute / Solo — reads from mixer channel */}
              <div className="flex gap-1">
                <button
                  onClick={() => ch && updateMixerChannel(ch.id, { mute: !muted })}
                  className={`w-6 h-5 rounded text-[8px] font-bold transition-all ${
                    muted
                      ? "bg-studio-record/20 text-studio-record border border-studio-record/30"
                      : "bg-studio-metal text-studio-text-dim border border-border"
                  }`}
                >
                  M
                </button>
                <button
                  onClick={() => ch && updateMixerChannel(ch.id, { solo: !soloed })}
                  className={`w-6 h-5 rounded text-[8px] font-bold transition-all ${
                    soloed
                      ? "bg-studio-teal/20 text-studio-teal border border-studio-teal/30"
                      : "bg-studio-metal text-studio-text-dim border border-border"
                  }`}
                >
                  S
                </button>
              </div>

              {/* Volume knob — reads/writes mixer channel */}
              <RotaryKnob
                value={Math.round(volume * 100)}
                onChange={(v) => ch && updateMixerChannel(ch.id, { volume: v / 100 })}
                size={40}
                label="Vol"
                active={!muted}
              />

              {/* VU Meter */}
              <VUMeter
                bars={10}
                active={!muted && audioActive}
                height={60}
                level={trackLevels[track.id] ?? 0}
              />

              {/* Color strip at bottom + left sidebar */}
              <div
                className="absolute bottom-0 left-0 right-0 h-1 rounded-b"
                style={{ background: color, opacity: muted ? 0.2 : 0.9 }}
              />
              <div
                className="absolute top-0 left-0 bottom-0 w-[3px]"
                style={{ background: color, opacity: muted ? 0.15 : 0.6 }}
              />
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default ChannelStrips;
