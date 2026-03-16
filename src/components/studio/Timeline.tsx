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
  MousePointer2,
  Scissors,
  Move,
} from "lucide-react";
import { useStudioStore } from "@/studio/engine/studioStore";
import { trackColorPalette } from "@/studio/types/studio";
import type { TimelineEditTool } from "@/studio/types/studio";
import WaveformCanvas from "@/components/studio/WaveformCanvas";
import { selectResolution } from "@/audio/waveformPeaks";
import type { WaveformPeaks, WaveformStatus, PeakResolution } from "@/studio/types/waveform";
import { getCachedPeaks, setCachedPeaks } from "@/audio/waveformCache";
import { generatePeaksFromFile, generatePeaksFromUrl } from "@/audio/waveformPeaks";

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
  /** When Alt is held during edge drag, we're time-stretching instead of trimming */
  stretch: boolean;
  initialPlaybackRate: number;
}

interface ClipSlipState {
  clipId: string;
  initialOffset: number;
  startClientX: number;
  undoPushed: boolean;
}

interface FadeDragState {
  clipId: string;
  edge: "in" | "out";
  initialDuration: number;
  clipStart: number;
  clipEnd: number;
  startClientX: number;
  undoPushed: boolean;
}

const MIN_CLIP_BEATS = 0.25;

/** Height of clip content area in pixels (track height minus top/bottom margins). */
const CLIP_HEIGHT = 68; // h-20 (80px) minus 1.5*4=6px top + 6px bottom

/**
 * Generate deterministic waveform peaks for demo/placeholder clips
 * that have no real audio source. Uses a seeded pattern based on clip ID
 * so the waveform is stable across renders and reloads.
 */
function generateDemoPeaks(clipId: string, numPeaks: number): PeakResolution {
  // Simple deterministic hash from clip ID
  let seed = 0;
  for (let i = 0; i < clipId.length; i++) {
    seed = ((seed << 5) - seed + clipId.charCodeAt(i)) | 0;
  }

  const min: number[] = new Array(numPeaks);
  const max: number[] = new Array(numPeaks);

  for (let i = 0; i < numPeaks; i++) {
    // Deterministic pseudo-random using seed
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const r1 = (seed % 1000) / 1000;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const r2 = (seed % 1000) / 1000;

    // Create a waveform-like pattern: envelope × (sine + noise)
    const envelope = Math.sin((i / numPeaks) * Math.PI) * 0.6 + 0.2;
    const wave = Math.sin(i * 0.4) * 0.3;

    max[i] = Math.min(1, (wave + r1 * 0.4) * envelope + 0.05);
    min[i] = Math.max(-1, -(wave + r2 * 0.4) * envelope - 0.05);
  }

  return { samplesPerPeak: 1024, channels: [{ min, max }] };
}

/**
 * Custom hook to manage waveform peaks for audio sources.
 * Handles loading from cache, generating from audio files/URLs,
 * and tracking loading status.
 */
function useWaveformPeaks() {
  const sources = useStudioStore((s) => s.sources);
  const [peaksMap, setPeaksMap] = useState<Record<string, WaveformPeaks>>({});
  const [statusMap, setStatusMap] = useState<Record<string, WaveformStatus>>({});

  const loadPeaks = useCallback(async (sourceId: string, file?: File, url?: string) => {
    try {
      // Check cache before setting status to avoid redundant state change
      const cached = await getCachedPeaks(sourceId);
      if (cached) {
        setPeaksMap((prev) => ({ ...prev, [sourceId]: cached }));
        setStatusMap((prev) => ({ ...prev, [sourceId]: "ready" }));
        return;
      }

      // Cache miss — show analyzing state while generating
      setStatusMap((prev) => ({ ...prev, [sourceId]: "analyzing" }));

      // Generate from file or URL
      let peaks: WaveformPeaks | null = null;
      if (file) {
        peaks = await generatePeaksFromFile(sourceId, file);
      } else if (url) {
        peaks = await generatePeaksFromUrl(sourceId, url);
      }

      if (peaks) {
        await setCachedPeaks(peaks);
        setPeaksMap((prev) => ({ ...prev, [sourceId]: peaks }));
        setStatusMap((prev) => ({ ...prev, [sourceId]: "ready" }));
      } else {
        setStatusMap((prev) => ({ ...prev, [sourceId]: "error" }));
      }
    } catch {
      setStatusMap((prev) => ({ ...prev, [sourceId]: "error" }));
    }
  }, []);

  // Process new sources that don't have peaks yet.
  // Sources in "error" state are skipped to prevent infinite retry loops;
  // they will be retried when the source list changes (e.g. re-import).
  useEffect(() => {
    for (const source of sources) {
      if (!peaksMap[source.id] && statusMap[source.id] !== "analyzing" && statusMap[source.id] !== "error") {
        loadPeaks(source.id, source.file, source.url);
      }
    }
  }, [sources, peaksMap, statusMap, loadPeaks]);

  return { peaksMap, statusMap };
}

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
  const editTool = useStudioStore((s) => s.editTool);
  const setEditTool = useStudioStore((s) => s.setEditTool);
  const splitClip = useStudioStore((s) => s.splitClip);
  const timelineRef = useRef<HTMLDivElement>(null);
  const { peaksMap, statusMap } = useWaveformPeaks();

  const [ctxMenu, setCtxMenu] = useState<ContextMenu | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const clipDragRef = useRef<ClipDragState | null>(null);
  const clipTrimRef = useRef<ClipTrimState | null>(null);
  const clipSlipRef = useRef<ClipSlipState | null>(null);
  const fadeDragRef = useRef<FadeDragState | null>(null);

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

    if (trim.stretch) {
      // Time-stretch mode: keep clip endpoints but change playback rate
      const originalDuration = trim.initialEnd - trim.initialStart;
      if (trim.edge === "right") {
        let newEnd = trim.initialEnd + deltaBeat;
        if (snapToGrid) newEnd = Math.round(newEnd * 4) / 4;
        newEnd = Math.max(trim.initialStart + MIN_CLIP_BEATS, newEnd);
        const newDuration = newEnd - trim.initialStart;
        const newRate = (originalDuration * trim.initialPlaybackRate) / newDuration;
        updateClip(trim.clipId, { end: newEnd, playbackRate: Math.max(0.1, Math.min(4, newRate)) });
      } else {
        let newStart = trim.initialStart + deltaBeat;
        if (snapToGrid) newStart = Math.round(newStart * 4) / 4;
        newStart = Math.min(newStart, trim.initialEnd - MIN_CLIP_BEATS);
        newStart = Math.max(0, newStart);
        const newDuration = trim.initialEnd - newStart;
        const newRate = (originalDuration * trim.initialPlaybackRate) / newDuration;
        updateClip(trim.clipId, { start: newStart, playbackRate: Math.max(0.1, Math.min(4, newRate)) });
      }
    } else {
      // Normal trim mode
      if (trim.edge === "left") {
        let newStart = trim.initialStart + deltaBeat;
        if (snapToGrid) newStart = Math.round(newStart * 4) / 4;
        newStart = Math.max(0, newStart);
        newStart = Math.min(newStart, trim.initialEnd - MIN_CLIP_BEATS);
        const newOffset = trim.initialOffset + (newStart - trim.initialStart);
        updateClip(trim.clipId, { start: newStart, offset: Math.max(0, newOffset) });
      } else {
        let newEnd = trim.initialEnd + deltaBeat;
        if (snapToGrid) newEnd = Math.round(newEnd * 4) / 4;
        newEnd = Math.max(trim.initialStart + MIN_CLIP_BEATS, newEnd);
        updateClip(trim.clipId, { end: newEnd });
      }
    }
  }, [beatWidth, pushUndo, snapToGrid, updateClip]);

  const onClipTrimEnd = useCallback(() => {
    clipTrimRef.current = null;
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onClipTrimMove);
    window.removeEventListener("mouseup", onClipTrimEnd);
  }, [onClipTrimMove]);

  const handleTrimMouseDown = useCallback((e: React.MouseEvent, clipId: string, edge: "left" | "right", start: number, end: number, offset: number, playbackRate: number) => {
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
      stretch: e.altKey,
      initialPlaybackRate: playbackRate,
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

  // ── Slip editing handlers (drag clip content by changing offset only) ──

  const onSlipMove = useCallback((e: MouseEvent) => {
    const slip = clipSlipRef.current;
    if (!slip) return;
    const dx = e.clientX - slip.startClientX;
    if (Math.abs(dx) > 2 && !slip.undoPushed) {
      pushUndo();
      slip.undoPushed = true;
    }
    const deltaBeats = dx / beatWidth;
    updateClip(slip.clipId, { offset: Math.max(0, slip.initialOffset - deltaBeats) });
  }, [beatWidth, pushUndo, updateClip]);

  const onSlipEnd = useCallback(() => {
    clipSlipRef.current = null;
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onSlipMove);
    window.removeEventListener("mouseup", onSlipEnd);
  }, [onSlipMove]);

  const handleSlipMouseDown = useCallback((e: React.MouseEvent, clipId: string, offset: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedClipId(clipId);
    clipSlipRef.current = {
      clipId,
      initialOffset: offset,
      startClientX: e.clientX,
      undoPushed: false,
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onSlipMove);
    window.addEventListener("mouseup", onSlipEnd);
  }, [onSlipEnd, onSlipMove, setSelectedClipId]);

  // ── Fade handle drag ──

  const onFadeDragMove = useCallback((e: MouseEvent) => {
    const fd = fadeDragRef.current;
    if (!fd) return;
    const dx = e.clientX - fd.startClientX;
    if (Math.abs(dx) > 2 && !fd.undoPushed) {
      pushUndo();
      fd.undoPushed = true;
    }
    const deltaBeats = dx / beatWidth;
    const clipDuration = fd.clipEnd - fd.clipStart;
    if (fd.edge === "in") {
      const newDur = Math.max(0, Math.min(clipDuration * 0.5, fd.initialDuration + deltaBeats));
      updateClip(fd.clipId, { fadeInDuration: newDur });
    } else {
      const newDur = Math.max(0, Math.min(clipDuration * 0.5, fd.initialDuration - deltaBeats));
      updateClip(fd.clipId, { fadeOutDuration: newDur });
    }
  }, [beatWidth, pushUndo, updateClip]);

  const onFadeDragEnd = useCallback(() => {
    fadeDragRef.current = null;
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onFadeDragMove);
    window.removeEventListener("mouseup", onFadeDragEnd);
  }, [onFadeDragMove]);

  const handleFadeMouseDown = useCallback((e: React.MouseEvent, clipId: string, edge: "in" | "out", currentDuration: number, clipStart: number, clipEnd: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    fadeDragRef.current = {
      clipId,
      edge,
      initialDuration: currentDuration,
      clipStart,
      clipEnd,
      startClientX: e.clientX,
      undoPushed: false,
    };
    document.body.style.cursor = "ew-resize";
    window.addEventListener("mousemove", onFadeDragMove);
    window.addEventListener("mouseup", onFadeDragEnd);
  }, [onFadeDragEnd, onFadeDragMove]);

  // ── Blade click handler ──

  const handleBladeClick = useCallback((e: React.MouseEvent, clipId: string, clipStartBeat: number) => {
    if (editTool !== "blade") return;
    e.stopPropagation();
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft - TRACK_LABEL_W;
    let atBeat = x / beatWidth;
    if (snapToGrid) atBeat = Math.round(atBeat * 4) / 4;
    splitClip(clipId, atBeat);
  }, [editTool, beatWidth, snapToGrid, splitClip]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onClipDragMove);
      window.removeEventListener("mouseup", onClipDragEnd);
      window.removeEventListener("mousemove", onClipTrimMove);
      window.removeEventListener("mouseup", onClipTrimEnd);
      window.removeEventListener("mousemove", onSlipMove);
      window.removeEventListener("mouseup", onSlipEnd);
      window.removeEventListener("mousemove", onFadeDragMove);
      window.removeEventListener("mouseup", onFadeDragEnd);
      document.body.style.cursor = "";
    };
  }, [onClipDragEnd, onClipDragMove, onClipTrimEnd, onClipTrimMove, onSlipEnd, onSlipMove, onFadeDragEnd, onFadeDragMove]);

  /** Memoized demo peaks cache keyed by clipId + numPeaks for stability. */
  const demoPeaksCache = useRef<Record<string, PeakResolution>>({});

  const getClipPeaks = useCallback(
    (clip: { id: string; sourceId?: string; color?: string }, clipWidth: number): { peaks: PeakResolution | null; status: WaveformStatus } => {
      // Real audio source — use waveform pipeline
      if (clip.sourceId && peaksMap[clip.sourceId]) {
        const waveform = peaksMap[clip.sourceId];
        return { peaks: selectResolution(waveform, zoom), status: "ready" };
      }
      if (clip.sourceId) {
        return { peaks: null, status: statusMap[clip.sourceId] ?? "pending" };
      }

      // Demo clip — generate deterministic peaks
      const numPeaks = Math.max(10, Math.round(clipWidth / 3));
      const cacheKey = `${clip.id}_${numPeaks}`;
      if (!demoPeaksCache.current[cacheKey]) {
        demoPeaksCache.current[cacheKey] = generateDemoPeaks(clip.id, numPeaks);
      }
      return { peaks: demoPeaksCache.current[cacheKey], status: "ready" };
    },
    [peaksMap, statusMap, zoom],
  );

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
    <div className="studio-panel h-full flex flex-col overflow-hidden">
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

        {/* ── Edit tool selector ── */}
        <div className="flex items-center gap-0.5 ml-2 border border-border rounded px-0.5 py-0.5">
          {([
            { tool: "select" as TimelineEditTool, icon: MousePointer2, label: "Select (V)", key: "V" },
            { tool: "blade" as TimelineEditTool, icon: Scissors, label: "Blade / Split (B)", key: "B" },
            { tool: "slip" as TimelineEditTool, icon: Move, label: "Slip (S)", key: "S" },
          ] as const).map(({ tool, icon: Icon, label }) => (
            <button
              key={tool}
              onClick={() => setEditTool(tool)}
              className={`p-1 rounded transition-colors ${
                editTool === tool
                  ? "bg-studio-teal/20 text-studio-teal"
                  : "text-studio-text-dim hover:bg-studio-metal"
              }`}
              title={label}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
        <span className="text-[7px] text-studio-text-dim/50 uppercase">Alt+drag = stretch</span>

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
                    const { peaks, status } = getClipPeaks(clip, width);
                    const fadeInPx = (clip.fadeInDuration ?? 0) * beatWidth;
                    const fadeOutPx = (clip.fadeOutDuration ?? 0) * beatWidth;
                    const rate = clip.playbackRate ?? 1;
                    const isStretched = Math.abs(rate - 1) > 0.01;
                    const isLocked = clip.locked ?? false;
                    const isBladeMode = editTool === "blade";
                    const isSlipMode = editTool === "slip";

                    // Detect crossfade overlaps on this track
                    const overlapping = trackClips.some(
                      (other) =>
                        other.id !== clip.id &&
                        other.start < clip.end &&
                        other.end > clip.start,
                    );

                    return (
                      <div
                        key={clip.id}
                        className={`absolute top-1.5 bottom-1.5 rounded-lg group overflow-hidden ${
                          isBladeMode
                            ? "cursor-crosshair"
                            : isSlipMode
                            ? "cursor-col-resize"
                            : isLocked
                            ? "cursor-not-allowed"
                            : "cursor-grab active:cursor-grabbing"
                        }`}
                        onMouseDown={(e) => {
                          if (isLocked) { e.stopPropagation(); return; }
                          if (isBladeMode) {
                            handleBladeClick(e, clip.id, clip.start);
                            return;
                          }
                          if (isSlipMode) {
                            handleSlipMouseDown(e, clip.id, clip.offset);
                            return;
                          }
                          handleClipMouseDown(e, clip.id, track.id, clip.start, clip.end);
                        }}
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
                        {/* Waveform — Canvas-based from peak data */}
                        {status === "ready" && peaks ? (
                          <WaveformCanvas
                            peaks={peaks}
                            width={width}
                            height={CLIP_HEIGHT}
                            color={clipColor}
                            opacity={0.4}
                          />
                        ) : status === "analyzing" ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span
                              className="text-[8px] animate-pulse"
                              style={{ color: clip.color }}
                            >
                              Analyzing…
                            </span>
                          </div>
                        ) : null}

                        {/* Fade-in overlay */}
                        {fadeInPx > 1 && (
                          <div
                            className="absolute top-0 bottom-0 left-0 pointer-events-none"
                            style={{
                              width: fadeInPx,
                              background: `linear-gradient(90deg, ${clipColor}50 0%, transparent 100%)`,
                            }}
                          />
                        )}

                        {/* Fade-out overlay */}
                        {fadeOutPx > 1 && (
                          <div
                            className="absolute top-0 bottom-0 right-0 pointer-events-none"
                            style={{
                              width: fadeOutPx,
                              background: `linear-gradient(270deg, ${clipColor}50 0%, transparent 100%)`,
                            }}
                          />
                        )}

                        {/* Crossfade overlap indicator */}
                        {overlapping && (
                          <div
                            className="absolute inset-0 pointer-events-none border-2 border-dashed rounded-lg"
                            style={{ borderColor: `${clipColor}60` }}
                          />
                        )}

                        {/* Center line */}
                        <div
                          className="absolute left-0 right-0 h-px top-1/2 -translate-y-px pointer-events-none"
                          style={{ background: `${clip.color}20` }}
                        />

                        <div className="absolute top-1 left-2 flex items-center gap-1">
                          <span className="text-[8px] font-semibold" style={{ color: clipColor }}>
                            {clip.name}
                          </span>
                          {/* Playback rate badge */}
                          {isStretched && (
                            <span
                              className="text-[7px] font-bold px-1 rounded"
                              style={{
                                color: clipColor,
                                background: `${clipColor}20`,
                              }}
                            >
                              {(rate * 100).toFixed(0)}%
                            </span>
                          )}
                          {isLocked && (
                            <span className="text-[7px] text-studio-text-dim">🔒</span>
                          )}
                        </div>

                        {/* Fade-in handle (top-left triangle) */}
                        {!isBladeMode && !isSlipMode && (
                          <div
                            className="absolute top-0 left-0 w-3 h-3 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-20"
                            onMouseDown={(e) =>
                              handleFadeMouseDown(e, clip.id, "in", clip.fadeInDuration ?? 0, clip.start, clip.end)
                            }
                            style={{
                              background: `linear-gradient(135deg, ${clipColor} 50%, transparent 50%)`,
                            }}
                            title="Drag to set fade-in"
                          />
                        )}

                        {/* Fade-out handle (top-right triangle) */}
                        {!isBladeMode && !isSlipMode && (
                          <div
                            className="absolute top-0 right-0 w-3 h-3 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-20"
                            onMouseDown={(e) =>
                              handleFadeMouseDown(e, clip.id, "out", clip.fadeOutDuration ?? 0, clip.start, clip.end)
                            }
                            style={{
                              background: `linear-gradient(225deg, ${clipColor} 50%, transparent 50%)`,
                            }}
                            title="Drag to set fade-out"
                          />
                        )}

                        {/* Trim handles (hidden in blade & slip modes) */}
                        {!isBladeMode && !isSlipMode && (
                          <>
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              onMouseDown={(e) =>
                                handleTrimMouseDown(e, clip.id, "left", clip.start, clip.end, clip.offset, rate)
                              }
                              style={{ background: `linear-gradient(90deg, ${clipColor}, transparent)` }}
                            />
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              onMouseDown={(e) =>
                                handleTrimMouseDown(e, clip.id, "right", clip.start, clip.end, clip.offset, rate)
                              }
                              style={{
                                background: `linear-gradient(270deg, ${clipColor}, transparent)`,
                              }}
                            />
                          </>
                        )}
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
