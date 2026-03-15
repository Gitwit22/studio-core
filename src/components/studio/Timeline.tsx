import { useRef, useMemo } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useStudioStore } from "@/studio/engine/studioStore";

const totalBeats = 64;

const Timeline = () => {
  const tracks = useStudioStore((s) => s.tracks);
  const clips = useStudioStore((s) => s.clips);
  const selectedClipId = useStudioStore((s) => s.selectedClipId);
  const setSelectedClipId = useStudioStore((s) => s.setSelectedClipId);
  const playheadPosition = useStudioStore((s) => s.playhead);
  const setPlayhead = useStudioStore((s) => s.setPlayhead);
  const zoom = useStudioStore((s) => s.zoom);
  const isRecording = useStudioStore((s) => s.isRecording);
  const timelineRef = useRef<HTMLDivElement>(null);

  const beatWidth = 40 * zoom;

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const beat = Math.max(0, Math.min(totalBeats, x / beatWidth));
    setPlayhead(beat);
    setSelectedClipId(null);
  };

  // Deterministic waveform based on clip id
  const generateWaveform = useMemo(() => {
    const cache = new Map<string, string>();
    return (clipId: string, width: number) => {
      const key = `${clipId}-${Math.round(width)}`;
      if (cache.has(key)) return cache.get(key)!;
      const points: string[] = [];
      const steps = Math.max(1, Math.floor(width / 3));
      let seed = clipId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const pseudoRandom = () => { seed = (seed * 16807 + 7) % 2147483647; return (seed & 0xffff) / 0xffff; };
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * width;
        const y = 10 + Math.sin(i * 0.8) * 6 + pseudoRandom() * 4;
        points.push(`${x},${y}`);
      }
      const mirroredPoints = points.map(p => {
        const [x, y] = p.split(",").map(Number);
        return `${x},${20 - (y - 10) + 10}`;
      }).reverse();
      const path = `M${points.join(" L")} L${mirroredPoints.join(" L")}Z`;
      cache.set(key, path);
      return path;
    };
  }, []);

  return (
    <div className="studio-panel flex-1 flex flex-col overflow-hidden">
      {/* Timeline header with ruler */}
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
        <button onClick={() => useStudioStore.setState((s) => ({ zoom: Math.max(0.5, s.zoom - 0.25) }))} className="p-1 rounded hover:bg-studio-metal">
          <ZoomOut className="w-3 h-3 text-studio-text-dim" />
        </button>
        <span className="studio-readout text-[9px]">{Math.round(zoom * 100)}%</span>
        <button onClick={() => useStudioStore.setState((s) => ({ zoom: Math.min(3, s.zoom + 0.25) }))} className="p-1 rounded hover:bg-studio-metal">
          <ZoomIn className="w-3 h-3 text-studio-text-dim" />
        </button>
      </div>

      {/* Ruler */}
      <div className="h-5 border-b border-border flex shrink-0 overflow-hidden">
        <div className="w-14 shrink-0 border-r border-border" />
        <div className="flex relative" style={{ width: totalBeats * beatWidth }}>
          {Array.from({ length: totalBeats + 1 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 flex flex-col items-center"
              style={{ left: i * beatWidth }}
            >
              <div className={`w-px ${i % 4 === 0 ? "h-full bg-border" : "h-2 bg-border/50"}`} />
              {i % 4 === 0 && (
                <span className="studio-readout text-[7px] absolute top-0.5 left-1">{i / 4 + 1}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tracks area */}
      <div className="flex-1 overflow-auto relative" ref={timelineRef} onClick={handleTimelineClick}>
        <div className="flex flex-col min-h-full">
          {tracks.length === 0 && (
            <div className="flex items-center justify-center flex-1 min-h-[200px] text-studio-text-dim text-xs uppercase tracking-wider">
              New session — ready to record
            </div>
          )}
          {tracks.map((track) => {
            const trackClips = clips.filter((c) => c.trackId === track.id);
            const color = track.color ?? "hsl(220 15% 60%)";
            return (
              <div key={track.id} className="flex h-20 border-b border-border">
                {/* Track label */}
                <div className="w-14 shrink-0 border-r border-border flex items-center justify-center">
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color }}
                  >
                    {track.name}
                  </span>
                </div>

                {/* Track content */}
                <div className="relative flex-1" style={{ minWidth: totalBeats * beatWidth }}>
                  {/* Grid lines */}
                  {Array.from({ length: totalBeats }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-px"
                      style={{
                        left: i * beatWidth,
                        background: i % 4 === 0 ? "hsl(220 15% 14%)" : "hsl(220 15% 10%)",
                      }}
                    />
                  ))}

                  {/* Clips from store */}
                  {trackClips.map((clip) => {
                    const width = (clip.end - clip.start) * beatWidth;
                    const clipColor = clip.color ?? color;
                    const selected = clip.id === selectedClipId;
                    return (
                      <div
                        key={clip.id}
                        className="absolute top-1.5 bottom-1.5 rounded-lg cursor-grab active:cursor-grabbing group overflow-hidden"
                        onClick={(e) => { e.stopPropagation(); setSelectedClipId(clip.id); }}
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
                        {/* Waveform */}
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

                        {/* Label */}
                        <div className="absolute top-1 left-2 flex items-center gap-1">
                          <span className="text-[8px] font-semibold" style={{ color: clipColor }}>
                            {clip.name}
                          </span>
                        </div>

                        {/* Drag handles */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: clipColor }}
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: clipColor }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-px bg-studio-teal z-10 pointer-events-none"
          style={{
            left: 56 + playheadPosition * beatWidth,
            boxShadow: "0 0 8px hsl(172 72% 55% / 0.5)",
          }}
        >
          <div className="w-2.5 h-2.5 -ml-[5px] -mt-0.5 bg-studio-teal" style={{ clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)" }} />
        </div>
      </div>
    </div>
  );
};

export default Timeline;
