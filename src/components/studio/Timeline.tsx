import { useState, useRef } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useStudioStore } from "@/studio/engine/studioStore";

interface Clip {
  id: string;
  trackIndex: number;
  startBeat: number;
  durationBeats: number;
  label: string;
  take: number;
  color: string;
}

const defaultClips: Clip[] = [
  { id: "1", trackIndex: 0, startBeat: 0, durationBeats: 32, label: "Beat", take: 1, color: "hsl(217 100% 71%)" },
  { id: "2", trackIndex: 1, startBeat: 4, durationBeats: 12, label: "Lead", take: 1, color: "hsl(172 72% 55%)" },
  { id: "3", trackIndex: 1, startBeat: 18, durationBeats: 10, label: "Lead", take: 2, color: "hsl(172 72% 55%)" },
  { id: "4", trackIndex: 2, startBeat: 6, durationBeats: 8, label: "Double", take: 1, color: "hsl(45 100% 60%)" },
  { id: "5", trackIndex: 2, startBeat: 20, durationBeats: 6, label: "Double", take: 2, color: "hsl(45 100% 60%)" },
  { id: "6", trackIndex: 3, startBeat: 10, durationBeats: 4, label: "Ad-Lib", take: 1, color: "hsl(280 70% 60%)" },
  { id: "7", trackIndex: 3, startBeat: 24, durationBeats: 5, label: "Ad-Lib", take: 2, color: "hsl(280 70% 60%)" },
];

const trackNames = ["Beat", "Lead", "Double", "Ad-Lib"];
const totalBeats = 32;

const Timeline = () => {
  const [clips] = useState<Clip[]>(defaultClips);
  const playheadPosition = useStudioStore((s) => s.playhead);
  const setPlayhead = useStudioStore((s) => s.setPlayhead);
  const zoom = useStudioStore((s) => s.zoom);
  const timelineRef = useRef<HTMLDivElement>(null);

  const beatWidth = 40 * zoom;

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const beat = Math.max(0, Math.min(totalBeats, x / beatWidth));
    setPlayhead(beat);
  };

  // Generate fake waveform path
  const generateWaveform = (width: number) => {
    const points: string[] = [];
    const steps = Math.floor(width / 3);
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const y = 10 + Math.sin(i * 0.8) * 6 + Math.random() * 4;
      points.push(`${x},${y}`);
    }
    const mirroredPoints = points.map(p => {
      const [x, y] = p.split(",").map(Number);
      return `${x},${20 - (y - 10) + 10}`;
    }).reverse();
    return `M${points.join(" L")} L${mirroredPoints.join(" L")}Z`;
  };

  return (
    <div className="studio-panel h-full flex flex-col overflow-hidden">
      {/* Timeline header with ruler */}
      <div className="flex items-center border-b border-border px-2 py-1 gap-2 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-studio-text-dim">
          Timeline
        </span>
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
                <span className="studio-readout text-[7px] absolute top-0.5 left-1">{i + 1}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tracks area */}
      <div className="flex-1 overflow-auto relative" ref={timelineRef} onClick={handleTimelineClick}>
        <div className="flex flex-col min-h-full">
          {trackNames.map((name, trackIndex) => (
            <div key={name} className="flex h-20 border-b border-border">
              {/* Track label */}
              <div className="w-14 shrink-0 border-r border-border flex items-center justify-center">
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: defaultClips.find(c => c.trackIndex === trackIndex)?.color }}
                >
                  {name}
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

                {/* Clips */}
                {clips
                  .filter(c => c.trackIndex === trackIndex)
                  .map(clip => {
                    const width = clip.durationBeats * beatWidth;
                    return (
                      <div
                        key={clip.id}
                        className="absolute top-1.5 bottom-1.5 rounded-lg cursor-grab active:cursor-grabbing group overflow-hidden"
                        style={{
                          left: clip.startBeat * beatWidth,
                          width,
                          background: `linear-gradient(180deg, ${clip.color}20, ${clip.color}10)`,
                          border: `1px solid ${clip.color}40`,
                          boxShadow: `inset 0 1px 0 ${clip.color}15, 0 0 8px ${clip.color}10`,
                        }}
                      >
                        {/* Waveform */}
                        <svg
                          className="absolute inset-0 w-full h-full opacity-40"
                          viewBox={`0 0 ${width} 20`}
                          preserveAspectRatio="none"
                        >
                          <path
                            d={generateWaveform(width)}
                            fill={clip.color}
                            opacity="0.5"
                          />
                        </svg>

                        {/* Label */}
                        <div className="absolute top-1 left-2 flex items-center gap-1">
                          <span className="text-[8px] font-semibold" style={{ color: clip.color }}>
                            {clip.label}
                          </span>
                          <span className="text-[7px] text-studio-text-dim">
                            T{clip.take}
                          </span>
                        </div>

                        {/* Drag handles */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: clip.color }}
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: clip.color }}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
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
