import { useState } from "react";
import RotaryKnob from "./RotaryKnob";
import ToggleSwitch from "./ToggleSwitch";
import VUMeter from "./VUMeter";

interface Track {
  id: string;
  name: string;
  color: string;
  volume: number;
  mute: boolean;
  solo: boolean;
  armed: boolean;
}

const defaultTracks: Track[] = [
  { id: "beat", name: "Beat", color: "hsl(217 100% 71%)", volume: 75, mute: false, solo: false, armed: false },
  { id: "lead", name: "Lead", color: "hsl(172 72% 55%)", volume: 80, mute: false, solo: false, armed: true },
  { id: "double", name: "Double", color: "hsl(45 100% 60%)", volume: 60, mute: false, solo: false, armed: false },
  { id: "adlib", name: "Ad-Lib", color: "hsl(280 70% 60%)", volume: 55, mute: true, solo: false, armed: false },
];

const ChannelStrips = () => {
  const [tracks, setTracks] = useState<Track[]>(defaultTracks);

  const updateTrack = (id: string, updates: Partial<Track>) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  return (
    <div className="studio-panel flex flex-col gap-0 h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-studio-text-dim">
          Channel Rack
        </span>
        <div className="flex gap-1.5">
          <div className="studio-screw" />
          <div className="studio-screw" />
        </div>
      </div>

      {/* Channels */}
      <div className="flex flex-1 overflow-hidden">
        {tracks.map((track) => (
          <div
            key={track.id}
            className="flex-1 flex flex-col items-center py-3 gap-2.5 border-r border-border last:border-r-0 relative"
            style={{
              background: track.armed
                ? `linear-gradient(180deg, hsl(0 100% 62% / 0.03), transparent)`
                : undefined,
            }}
          >
            {/* Track name */}
            <span
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: track.color }}
            >
              {track.name}
            </span>

            {/* Record arm */}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  track.armed
                    ? "bg-studio-record shadow-[0_0_8px_hsl(0_100%_62%/0.5)] animate-record-pulse"
                    : "bg-studio-metal-light"
                }`}
              />
              <span className="text-[7px] text-studio-text-dim uppercase">Rec</span>
            </div>

            {/* Mute / Solo buttons */}
            <div className="flex gap-1">
              <button
                onClick={() => updateTrack(track.id, { mute: !track.mute })}
                className={`w-6 h-5 rounded text-[8px] font-bold transition-all ${
                  track.mute
                    ? "bg-studio-record/20 text-studio-record border border-studio-record/30"
                    : "bg-studio-metal text-studio-text-dim border border-border"
                }`}
              >
                M
              </button>
              <button
                onClick={() => updateTrack(track.id, { solo: !track.solo })}
                className={`w-6 h-5 rounded text-[8px] font-bold transition-all ${
                  track.solo
                    ? "bg-studio-teal/20 text-studio-teal border border-studio-teal/30"
                    : "bg-studio-metal text-studio-text-dim border border-border"
                }`}
              >
                S
              </button>
            </div>

            {/* Volume knob */}
            <RotaryKnob
              value={track.volume}
              onChange={(v) => updateTrack(track.id, { volume: v })}
              size={40}
              label="Vol"
              active={!track.mute}
            />

            {/* VU Meter */}
            <VUMeter bars={10} active={!track.mute} height={60} />

            {/* Color strip at bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ background: track.color, opacity: track.mute ? 0.2 : 0.8 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChannelStrips;
