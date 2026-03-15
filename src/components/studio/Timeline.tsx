import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  Trash2,
  Copy,
  Volume2,
  Upload,
  Mic,
  PenLine,
  Palette,
  Snowflake,
  Maximize2,
  Flag,
  Repeat,
} from "lucide-react";
import { useStudioStore } from "@/studio/engine/studioStore";
import { trackColorPalette } from "@/studio/types/studio";

// Layout constants
const TRACK_LABEL_W = 56;       // px – matches Tailwind w-14
const PIXELS_PER_BEAT = 40;     // px per beat at zoom 1.0
const MIN_TOTAL_BEATS = 32;     // minimum timeline length
const TAIL_PADDING = 16;        // empty beats after last clip
const RULER_H = 28;             // ruler row height (bar + seconds)

const LANE_PRESETS: Record<string, number> = { Compact: 40, Standard: 80, Large: 120 };

const fxLabels: Record<string, string> = {
  compressor: "COMP",
  delay: "DLY",
  reverb: "REV",
  eq: "EQ",
  pitchShifter: "PITCH",
  limiter: "LIM",
};

interface ContextMenu {
  x: number;
  y: number;
  trackId: string;
  clipId?: string;
}

interface ClipDragState {
  clipId: string;
  trackId: string;
  initialStart: number;
  initialEnd: number;
  startClientX: number;
  startClientY: number;
  undoPushed: boolean;
}

interface ClipTrimState {
  clipId: string;
  edge: "left" | "right";
  initialStart: number;
  initialEnd: number;
  initialOffset: number;
  startClientX: number;
  undoPushed: boolean;
}

const MIN_CLIP_BEATS = 0.25;

const Timeline = () => {
  const tracks = useStudioStore((s) => s.tracks);
  const clips = useStudioStore((s) => s.clips);
  const mixerChannels = useStudioStore((s) => s.mixerChannels);
  const selectedClipId = useStudioStore((s) => s.selectedClipId);
  const setSelectedClipId = useStudioStore((s) => s.setSelectedClipId);
  const selectedTrackId = useStudioStore((s) => s.selectedTrackId);
  const setSelectedTrackId = useStudioStore((s) => s.setSelectedTrackId);
  const playheadPosition = useStudioStore((s) => s.playhead);
  const setPlayhead = useStudioStore((s) => s.setPlayhead);
  const zoom = useStudioStore((s) => s.zoom);
  const setZoom = useStudioStore((s) => s.setZoom);
  const isRecording = useStudioStore((s) => s.isRecording);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const bpm = useStudioStore((s) => s.bpm);
  const removeTrack = useStudioStore((s) => s.removeTrack);
  const removeClip = useStudioStore((s) => s.removeClip);
  const updateClip = useStudioStore((s) => s.updateClip);
  const updateTrack = useStudioStore((s) => s.updateTrack);
  const updateMixerChannel = useStudioStore((s) => s.updateMixerChannel);
  const pushUndo = useStudioStore((s) => s.pushUndo);
  const snapToGrid = useStudioStore((s) => s.snapToGrid);
  const toggleSnapToGrid = useStudioStore((s) => s.toggleSnapToGrid);
  const trackLaneHeight = useStudioStore((s) => s.trackLaneHeight);
  const setTrackLaneHeight = useStudioStore((s) => s.setTrackLaneHeight);
  const loop = useStudioStore((s) => s.loop);
  const toggleLoop = useStudioStore((s) => s.toggleLoop);
  const markers = useStudioStore((s) => s.markers);
  const addMarker = useStudioStore((s) => s.addMarker);
  const removeMarker = useStudioStore((s) => s.removeMarker);

  const [ctxMenu, setCtxMenu] = useState<ContextMenu | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const clipDragRef = useRef<ClipDragState | null>(null);
  const clipTrimRef = useRef<ClipTrimState | null>(null);

  const beatWidth = PIXELS_PER_BEAT * zoom;

  // Dynamic project length: furthest clip end + tail, minimum MIN_TOTAL_BEATS
  const projectTotalBeats = useMemo(() => {
    if (clips.length === 0) return MIN_TOTAL_BEATS;
    const maxEnd = Math.max(...clips.map((c) => c.end));
    return Math.max(MIN_TOTAL_BEATS, Math.ceil(maxEnd) + TAIL_PADDING);
  }, [clips]);

  const totalWidth = projectTotalBeats * beatWidth;

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [ctxMenu]);

  const handleTrackContextMenu = useCallback((e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTrackId(trackId);
    setCtxMenu({ x: e.clientX, y: e.clientY, trackId });
  }, [setSelectedTrackId]);

  const handleClipContextMenu = useCallback((e: React.MouseEvent, trackId: string, clipId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, trackId, clipId });
  }, []);

  const handleDeleteClip = useCallback(() => {
    if (!ctxMenu?.clipId) return;
    pushUndo();
    removeClip(ctxMenu.clipId);
    setCtxMenu(null);
  }, [ctxMenu, pushUndo, removeClip]);

  const handleDeleteTrack = useCallback(() => {
    if (!ctxMenu) return;
    pushUndo();
    removeTrack(ctxMenu.trackId);
    setCtxMenu(null);
  }, [ctxMenu, pushUndo, removeTrack]);

  const handleToggleMute = useCallback(() => {
    if (!ctxMenu) return;
    const track = tracks.find((t) => t.id === ctxMenu.trackId);
    if (!track) return;
    const ch = mixerChannels.find((c) => c.id === track.channelId);
    if (ch) updateMixerChannel(ch.id, { mute: !ch.mute });
    setCtxMenu(null);
  }, [ctxMenu, tracks, mixerChannels, updateMixerChannel]);

  const handleImportToTrack = useCallback(() => {
    if (!ctxMenu) return;
    window.dispatchEvent(new CustomEvent("studio:import-audio", { detail: { trackId: ctxMenu.trackId } }));
    setCtxMenu(null);
  }, [ctxMenu]);

  const handleToggleArm = useCallback(() => {
    if (!ctxMenu) return;
    const track = tracks.find((t) => t.id === ctxMenu.trackId);
    if (!track) return;
    updateTrack(track.id, { armed: !track.armed });
    setCtxMenu(null);
  }, [ctxMenu, tracks, updateTrack]);

  const handleDuplicateTrack = useCallback(() => {
    if (!ctxMenu) return;
    const track = tracks.find((t) => t.id === ctxMenu.trackId);
    if (!track) return;

    pushUndo();
    const store = useStudioStore.getState();
    const newId = store.addTrack(track.type, `${track.name} Copy`, track.color);
    store.updateTrack(newId, {
      frozen: track.frozen,
      busId: track.busId,
      fxChain: track.fxChain.map((slot) => ({ ...slot, params: { ...slot.params } })),
    });

    const sourceTrackChannel = store.mixerChannels.find((c) => c.id === track.channelId);
    const newTrack = store.tracks.find((t) => t.id === newId);
    const targetChannel = newTrack
      ? store.mixerChannels.find((c) => c.id === newTrack.channelId)
      : undefined;
    if (sourceTrackChannel && targetChannel) {
      store.updateMixerChannel(targetChannel.id, {
        volume: sourceTrackChannel.volume,
        pan: sourceTrackChannel.pan,
        mute: sourceTrackChannel.mute,
        solo: sourceTrackChannel.solo,
      });
    }

    const trackClips = clips.filter((c) => c.trackId === track.id);
    for (const clip of trackClips) {
      store.addClip({
        trackId: newId,
        sourceId: clip.sourceId,
        start: clip.start,
        end: clip.end,
        offset: clip.offset,
        name: clip.name,
        color: clip.color,
      });
    }

    setCtxMenu(null);
  }, [ctxMenu, tracks, clips, pushUndo]);

  const handleRenameTrack = useCallback(() => {
    if (!ctxMenu) return;
    const track = tracks.find((t) => t.id === ctxMenu.trackId);
    if (!track) return;
    const next = window.prompt("Rename track", track.name)?.trim();
    if (!next || next === track.name) {
      setCtxMenu(null);
      return;
    }
    pushUndo();
    updateTrack(track.id, { name: next });
    setCtxMenu(null);
  }, [ctxMenu, tracks, pushUndo, updateTrack]);

  const handleChangeTrackColor = useCallback(() => {
    // Handled by inline color palette in context menu — see ctxMenu rendering
  }, []);

  const handleToggleFreezeTrack = useCallback(() => {
    if (!ctxMenu) return;
    const track = tracks.find((t) => t.id === ctxMenu.trackId);
    if (!track) return;
    pushUndo();
    updateTrack(track.id, { frozen: !track.frozen });
    setCtxMenu(null);
  }, [ctxMenu, tracks, pushUndo, updateTrack]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft - TRACK_LABEL_W;
    if (x < 0) return;
    const beat = Math.max(0, Math.min(projectTotalBeats, x / beatWidth));
    setPlayhead(beat);
    setSelectedClipId(null);
  };

  const onClipDragMove = useCallback((e: MouseEvent) => {
    const drag = clipDragRef.current;
    if (!drag || !scrollRef.current || tracks.length === 0) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    const movedEnough = Math.abs(dx) > 2 || Math.abs(dy) > 2;
    if (movedEnough && !drag.undoPushed) {
      pushUndo();
      drag.undoPushed = true;
    }

    const duration = drag.initialEnd - drag.initialStart;
    let nextStart = drag.initialStart + dx / beatWidth;
    if (snapToGrid) {
      nextStart = Math.round(nextStart);
    }
    nextStart = Math.max(0, nextStart);

    const rect = scrollRef.current.getBoundingClientRect();
    const yInContent = e.clientY - rect.top + scrollRef.current.scrollTop - RULER_H;
    const trackIndex = Math.max(0, Math.min(tracks.length - 1, Math.floor(yInContent / trackLaneHeight)));
    const targetTrackId = tracks[trackIndex]?.id ?? drag.trackId;

    updateClip(drag.clipId, {
      start: nextStart,
      end: nextStart + duration,
      trackId: targetTrackId,
    });
  }, [beatWidth, pushUndo, snapToGrid, tracks, trackLaneHeight, updateClip]);

  const onClipDragEnd = useCallback(() => {
    clipDragRef.current = null;
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onClipDragMove);
    window.removeEventListener("mouseup", onClipDragEnd);
  }, [onClipDragMove]);

  // ── Clip trim (resize) handlers ──

  const onClipTrimMove = useCallback((e: MouseEvent) => {
    const trim = clipTrimRef.current;
    if (!trim) return;

    const dx = e.clientX - trim.startClientX;
    if (Math.abs(dx) > 2 && !trim.undoPushed) {
      pushUndo();
      trim.undoPushed = true;
    }

    const deltaBeat = dx / beatWidth;

    if (trim.edge === "left") {
      let newStart = trim.initialStart + deltaBeat;
      if (snapToGrid) newStart = Math.round(newStart * 4) / 4;
      newStart = Math.max(0, newStart);
      // Don't let left edge pass right edge
      newStart = Math.min(newStart, trim.initialEnd - MIN_CLIP_BEATS);
      const newOffset = trim.initialOffset + (newStart - trim.initialStart);
      updateClip(trim.clipId, { start: newStart, offset: Math.max(0, newOffset) });
    } else {
      let newEnd = trim.initialEnd + deltaBeat;
      if (snapToGrid) newEnd = Math.round(newEnd * 4) / 4;
      newEnd = Math.max(trim.initialStart + MIN_CLIP_BEATS, newEnd);
      updateClip(trim.clipId, { end: newEnd });
    }
  }, [beatWidth, pushUndo, snapToGrid, updateClip]);

  const onClipTrimEnd = useCallback(() => {
    clipTrimRef.current = null;
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onClipTrimMove);
    window.removeEventListener("mouseup", onClipTrimEnd);
  }, [onClipTrimMove]);

  const handleTrimMouseDown = useCallback((e: React.MouseEvent, clipId: string, edge: "left" | "right", start: number, end: number, offset: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedClipId(clipId);
    clipTrimRef.current = {
      clipId,
      edge,
      initialStart: start,
      initialEnd: end,
      initialOffset: offset,
      startClientX: e.clientX,
      undoPushed: false,
    };
    document.body.style.cursor = "ew-resize";
    window.addEventListener("mousemove", onClipTrimMove);
    window.addEventListener("mouseup", onClipTrimEnd);
  }, [onClipTrimEnd, onClipTrimMove, setSelectedClipId]);

  const handleClipMouseDown = useCallback((e: React.MouseEvent, clipId: string, trackId: string, start: number, end: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedClipId(clipId);
    setSelectedTrackId(trackId);
    clipDragRef.current = {
      clipId,
      trackId,
      initialStart: start,
      initialEnd: end,
      startClientX: e.clientX,
      startClientY: e.clientY,
      undoPushed: false,
    };
    document.body.style.cursor = "grabbing";
    window.addEventListener("mousemove", onClipDragMove);
    window.addEventListener("mouseup", onClipDragEnd);
  }, [onClipDragEnd, onClipDragMove, setSelectedClipId, setSelectedTrackId]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onClipDragMove);
      window.removeEventListener("mouseup", onClipDragEnd);
      window.removeEventListener("mousemove", onClipTrimMove);
      window.removeEventListener("mouseup", onClipTrimEnd);
      document.body.style.cursor = "";
    };
  }, [onClipDragEnd, onClipDragMove, onClipTrimEnd, onClipTrimMove]);

  const generateWaveform = useMemo(() => {
    const cache = new Map<string, string>();
    return (clipId: string, width: number) => {
      const key = `${clipId}-${Math.round(width)}`;
      if (cache.has(key)) return cache.get(key)!;
      const points: string[] = [];
      const steps = Math.max(1, Math.floor(width / 3));
      let seed = clipId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const pseudoRandom = () => {
        seed = (seed * 16807 + 7) % 2147483647;
        return (seed & 0xffff) / 0xffff;
      };
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * width;
        const y = 10 + Math.sin(i * 0.8) * 6 + pseudoRandom() * 4;
        points.push(`${x},${y}`);
      }
      const mirroredPoints = points
        .map((p) => {
          const [x, y] = p.split(",").map(Number);
          return `${x},${20 - (y - 10) + 10}`;
        })
        .reverse();
      const path = `M${points.join(" L")} L${mirroredPoints.join(" L")}Z`;
      cache.set(key, path);
      return path;
    };
  }, []);

  // Fit project: compute zoom so entire project fits in viewport
  const fitProject = useCallback(() => {
    if (!scrollRef.current) return;
    const availableW = scrollRef.current.clientWidth - TRACK_LABEL_W;
    const newZoom = Math.min(3, Math.max(0.1, availableW / (projectTotalBeats * PIXELS_PER_BEAT)));
    setZoom(Math.round(newZoom * 100) / 100);
    scrollRef.current.scrollLeft = 0;
  }, [projectTotalBeats, setZoom]);

  // Auto-scroll during playback / recording
  useEffect(() => {
    if ((!isPlaying && !isRecording) || !scrollRef.current) return;
    const el = scrollRef.current;
    const playheadPx = TRACK_LABEL_W + playheadPosition * beatWidth;
    const viewLeft = el.scrollLeft;
    const viewRight = viewLeft + el.clientWidth;
    if (playheadPx > viewRight - 60 || playheadPx < viewLeft + TRACK_LABEL_W) {
      el.scrollLeft = playheadPx - el.clientWidth * 0.33;
    }
  }, [playheadPosition, beatWidth, isPlaying, isRecording]);

  // Format beat position as seconds string
  const beatToSeconds = useCallback((beat: number) => {
    const sec = beat * 60 / bpm;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
  }, [bpm]);

  // Handle ruler double-click to add marker
  const handleRulerDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const beat = Math.max(0, x / beatWidth);
    const name = window.prompt("Marker name", `Marker`)?.trim();
    if (!name) return;
    addMarker(beat, name);
  }, [beatWidth, addMarker]);

  return (
  return (
    <div className="studio-panel flex-1 flex flex-col overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center border-b border-border px-2 py-1 gap-2 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-studio-text-dim">
          Timeline
        </span>
        {isRecording && (
          <span className="text-[8px] text-studio-record uppercase tracking-wider animate-record-pulse">
            ● REC
          </span>
        )}
        <div className="flex-1" />

        {/* Loop toggle */}
        <button
          onClick={toggleLoop}
          className={`p-1 rounded transition-colors ${
            loop.enabled
              ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
              : "hover:bg-studio-metal text-studio-text-dim"
          }`}
          title="Toggle loop region"
        >
          <Repeat className="w-3 h-3" />
        </button>

        {/* Snap toggle */}
        <button
          onClick={toggleSnapToGrid}
          className={`px-2 py-1 rounded text-[9px] font-semibold uppercase tracking-wider border transition-colors ${
            snapToGrid
              ? "bg-studio-teal/15 text-studio-teal border-studio-teal/40"
              : "bg-studio-metal text-studio-text-dim border-border"
          }`}
          title="Toggle movement mode (G)"
        >
          {snapToGrid ? "Snap" : "Free"} · G
        </button>

        {/* Lane height selector */}
        <div className="flex items-center gap-1">
          {Object.entries(LANE_PRESETS).map(([label, h]) => (
            <button
              key={label}
              onClick={() => setTrackLaneHeight(h)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider transition-colors ${
                trackLaneHeight === h
                  ? "bg-studio-teal/15 text-studio-teal"
                  : "text-studio-text-dim hover:bg-studio-metal"
              }`}
            >
              {label[0]}
            </button>
          ))}
        </div>

        {/* Fit project */}
        <button onClick={fitProject} className="p-1 rounded hover:bg-studio-metal" title="Fit project in view">
          <Maximize2 className="w-3 h-3 text-studio-text-dim" />
        </button>

        {/* Zoom controls */}
        <button
          onClick={() => setZoom(Math.max(0.1, zoom - 0.25))}
          className="p-1 rounded hover:bg-studio-metal"
        >
          <ZoomOut className="w-3 h-3 text-studio-text-dim" />
        </button>
        <span className="studio-readout text-[9px]">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          className="p-1 rounded hover:bg-studio-metal"
        >
          <ZoomIn className="w-3 h-3 text-studio-text-dim" />
        </button>
      </div>

      {/* ── Scrollable timeline area ── */}
      <div className="flex-1 overflow-auto relative" ref={scrollRef} onClick={handleTimelineClick}>
        <div className="relative" style={{ width: totalWidth + TRACK_LABEL_W, minHeight: "100%" }}>

          {/* ── Ruler (sticky top) ── */}
          <div
            className="sticky top-0 z-20 flex border-b border-border bg-studio-panel"
            style={{ height: RULER_H }}
          >
            {/* Ruler label column */}
            <div
              className="shrink-0 border-r border-border flex items-end justify-center pb-0.5 sticky left-0 z-30 bg-studio-panel"
              style={{ width: TRACK_LABEL_W }}
            >
              <span className="text-[7px] text-studio-text-dim uppercase">{bpm} bpm</span>
            </div>

            {/* Ruler content */}
            <div
              className="relative select-none"
              style={{ width: totalWidth }}
              onDoubleClick={handleRulerDoubleClick}
            >
              {/* Loop region on ruler */}
              {loop.enabled && (
                <div
                  className="absolute top-0 bottom-0 bg-amber-400/15 border-x border-amber-400/40"
                  style={{
                    left: loop.start * beatWidth,
                    width: (loop.end - loop.start) * beatWidth,
                  }}
                />
              )}

              {/* Beat ticks + bar numbers */}
              {Array.from({ length: projectTotalBeats + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 flex flex-col items-center"
                  style={{ left: i * beatWidth }}
                >
                  <div className={`w-px ${i % 4 === 0 ? "h-full bg-border" : "h-2 bg-border/50"}`} />
                  {i % 4 === 0 && (
                    <>
                      <span className="studio-readout text-[7px] absolute top-0.5 left-1">
                        {i / 4 + 1}
                      </span>
                      <span className="studio-readout text-[6px] absolute bottom-0.5 left-1 text-studio-text-dim/60">
                        {beatToSeconds(i)}
                      </span>
                    </>
                  )}
                </div>
              ))}

              {/* Markers on ruler */}
              {markers.map((m) => (
                <div
                  key={m.id}
                  className="absolute top-0 bottom-0 group/marker"
                  style={{ left: m.position * beatWidth }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.confirm(`Delete marker "${m.name}"?`)) removeMarker(m.id);
                  }}
                >
                  <div className="w-px h-full" style={{ background: m.color }} />
                  <div
                    className="absolute -top-0.5 -left-1 flex items-center gap-0.5 cursor-default"
                    title={m.name}
                  >
                    <Flag className="w-2.5 h-2.5" style={{ color: m.color }} />
                    <span
                      className="text-[6px] font-semibold uppercase tracking-wider whitespace-nowrap opacity-0 group-hover/marker:opacity-100 transition-opacity"
                      style={{ color: m.color }}
                    >
                      {m.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Track rows ── */}
          {tracks.length === 0 && (
            <div className="flex items-center justify-center min-h-[200px] text-studio-text-dim text-xs uppercase tracking-wider">
              New session – ready to record
            </div>
          )}

          {tracks.map((track) => {
            const trackClips = clips.filter((c) => c.trackId === track.id);
            const color = track.color ?? "hsl(220 15% 60%)";
            return (
              <div
                key={track.id}
                className="flex border-b border-border"
                style={{ height: trackLaneHeight }}
              >
                {/* Sticky track label */}
                <div
                  className={`shrink-0 border-r border-border flex flex-col items-center justify-center gap-0.5 cursor-pointer sticky left-0 z-10 bg-studio-panel ${
                    track.id === selectedTrackId ? "bg-studio-teal/5" : ""
                  }`}
                  style={{ width: TRACK_LABEL_W }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTrackId(track.id);
                  }}
                  onContextMenu={(e) => handleTrackContextMenu(e, track.id)}
                >
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider truncate max-w-[48px]"
                    style={{ color }}
                  >
                    {track.name}
                  </span>
                  {trackLaneHeight >= 60 && (
                    <div className="flex flex-wrap justify-center gap-px mt-0.5">
                      {track.fxChain.map((fx) => (
                        <span
                          key={fx.type}
                          className="text-[5px] font-bold uppercase leading-none px-0.5 rounded-sm"
                          style={{
                            color: fx.enabled ? "hsl(172 72% 55%)" : "hsl(220 15% 40%)",
                            background: fx.enabled ? "hsl(172 72% 55% / 0.1)" : "transparent",
                          }}
                        >
                          {fxLabels[fx.type] ?? fx.type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Track content area */}
                <div className="relative" style={{ width: totalWidth }}>
                  {/* Grid lines */}
                  {Array.from({ length: projectTotalBeats }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-px"
                      style={{
                        left: i * beatWidth,
                        background: i % 4 === 0 ? "hsl(220 15% 14%)" : "hsl(220 15% 10%)",
                      }}
                    />
                  ))}

                  {/* Loop region overlay on track */}
                  {loop.enabled && (
                    <div
                      className="absolute top-0 bottom-0 bg-amber-400/5 pointer-events-none"
                      style={{
                        left: loop.start * beatWidth,
                        width: (loop.end - loop.start) * beatWidth,
                      }}
                    />
                  )}

                  {/* Clips */}
                  {trackClips.map((clip) => {
                    const width = (clip.end - clip.start) * beatWidth;
                    const clipColor = clip.color ?? color;
                    const selected = clip.id === selectedClipId;
                    return (
                      <div
                        key={clip.id}
                        className="absolute top-1.5 bottom-1.5 rounded-lg cursor-grab active:cursor-grabbing group overflow-hidden"
                        onMouseDown={(e) =>
                          handleClipMouseDown(e, clip.id, track.id, clip.start, clip.end)
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClipId(clip.id);
                        }}
                        onContextMenu={(e) => handleClipContextMenu(e, track.id, clip.id)}
                        style={{
                          left: clip.start * beatWidth,
                          width,
                          background: `linear-gradient(180deg, ${clipColor}20, ${clipColor}10)`,
                          border: selected
                            ? `2px solid ${clipColor}`
                            : `1px solid ${clipColor}40`,
                          boxShadow: selected
                            ? `0 0 12px ${clipColor}40`
                            : `inset 0 1px 0 ${clipColor}15, 0 0 8px ${clipColor}10`,
                        }}
                      >
                        <svg
                          className="absolute inset-0 w-full h-full opacity-40"
                          viewBox={`0 0 ${width} 20`}
                          preserveAspectRatio="none"
                        >
                          <path
                            d={generateWaveform(clip.id, width)}
                            fill={clipColor}
                            opacity="0.5"
                          />
                        </svg>

                        <div className="absolute top-1 left-2 flex items-center gap-1">
                          <span className="text-[8px] font-semibold" style={{ color: clipColor }}>
                            {clip.name}
                          </span>
                        </div>

                        {/* Trim handles */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          onMouseDown={(e) =>
                            handleTrimMouseDown(e, clip.id, "left", clip.start, clip.end, clip.offset)
                          }
                          style={{ background: `linear-gradient(90deg, ${clipColor}, transparent)` }}
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          onMouseDown={(e) =>
                            handleTrimMouseDown(e, clip.id, "right", clip.start, clip.end, clip.offset)
                          }
                          style={{
                            background: `linear-gradient(270deg, ${clipColor}, transparent)`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ── Playhead ── */}
          <div
            className="absolute top-0 bottom-0 w-px bg-studio-teal z-30 pointer-events-none"
            style={{
              left: TRACK_LABEL_W + playheadPosition * beatWidth,
              boxShadow: "0 0 8px hsl(172 72% 55% / 0.5)",
            }}
          >
            <div
              className="w-2.5 h-2.5 -ml-[5px] -mt-0.5 bg-studio-teal"
              style={{ clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)" }}
            />
          </div>
        </div>

        {/* ── Context Menu ── */}
        {ctxMenu && (
          <div
            className="fixed z-50 min-w-[196px] rounded-lg border border-border bg-studio-panel shadow-xl py-1"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {ctxMenu.clipId ? (
              <button
                onClick={handleDeleteClip}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-studio-record hover:bg-studio-record/10 transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Clip
              </button>
            ) : (
              (() => {
                const t = tracks.find((tr) => tr.id === ctxMenu.trackId);
                const ch = t ? mixerChannels.find((c) => c.id === t.channelId) : undefined;
                return (
                  <>
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-studio-text-dim">
                      Right Click Track
                    </div>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={handleImportToTrack}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-foreground hover:bg-studio-metal transition-colors text-left"
                    >
                      <Upload className="w-3.5 h-3.5 text-studio-text-dim" />
                      Import Audio to Track
                    </button>
                    <button
                      onClick={handleToggleArm}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-foreground hover:bg-studio-metal transition-colors text-left"
                    >
                      <Mic className="w-3.5 h-3.5 text-studio-text-dim" />
                      {t?.armed ? "Disarm Record" : "Record Arm"}
                    </button>
                    <button
                      onClick={handleDuplicateTrack}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-foreground hover:bg-studio-metal transition-colors text-left"
                    >
                      <Copy className="w-3.5 h-3.5 text-studio-text-dim" />
                      Duplicate Track
                    </button>
                    <button
                      onClick={handleRenameTrack}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-foreground hover:bg-studio-metal transition-colors text-left"
                    >
                      <PenLine className="w-3.5 h-3.5 text-studio-text-dim" />
                      Rename
                    </button>
                    <div className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Palette className="w-3 h-3 text-studio-text-dim" />
                        <span className="text-[9px] text-studio-text-dim uppercase tracking-wider">
                          Color
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(trackColorPalette).map(([name, hsl]) => (
                          <button
                            key={name}
                            title={name}
                            onClick={() => {
                              if (!ctxMenu) return;
                              pushUndo();
                              updateTrack(ctxMenu.trackId, { color: hsl });
                              setCtxMenu(null);
                            }}
                            className="w-4 h-4 rounded-full border border-border hover:scale-125 transition-transform"
                            style={{
                              background: hsl,
                              boxShadow: t?.color === hsl ? `0 0 0 2px ${hsl}` : undefined,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleToggleFreezeTrack}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-foreground hover:bg-studio-metal transition-colors text-left"
                    >
                      <Snowflake className="w-3.5 h-3.5 text-studio-text-dim" />
                      {t?.frozen ? "Unfreeze Track" : "Freeze Track"}
                    </button>
                    <button
                      onClick={handleToggleMute}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-foreground hover:bg-studio-metal transition-colors text-left"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-studio-text-dim" />
                      {ch?.mute ? "Unmute" : "Mute"}
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={handleDeleteTrack}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-studio-record hover:bg-studio-record/10 transition-colors text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Track
                    </button>
                  </>
                );
              })()
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Timeline;
