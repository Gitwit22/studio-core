import { useState } from "react";
import TransportButton from "./TransportButton";
import { SkipBack, Play, Pause, Square, Circle, Repeat } from "lucide-react";

const TransportControls = () => {
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [looping, setLooping] = useState(false);

  return (
    <div className="studio-panel h-16 shrink-0 flex items-center justify-center gap-3 px-6">
      {/* Left: Timecode */}
      <div className="studio-panel-raised rounded px-3 py-1.5 flex items-center gap-2 mr-6">
        <span className="studio-readout text-sm tracking-widest">00:08:24</span>
        <div className="w-px h-4 bg-border" />
        <span className="text-[9px] text-studio-text-dim uppercase tracking-wider">Bar 3</span>
      </div>

      {/* Transport buttons */}
      <TransportButton
        icon={<SkipBack className="w-4 h-4" />}
        onClick={() => { setPlaying(false); setRecording(false); }}
      />
      <TransportButton
        icon={playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        active={playing}
        variant="play"
        onClick={() => setPlaying(!playing)}
      />
      <TransportButton
        icon={<Square className="w-3.5 h-3.5" />}
        onClick={() => { setPlaying(false); setRecording(false); }}
      />
      <TransportButton
        icon={<Circle className="w-4 h-4" />}
        active={recording}
        variant="record"
        onClick={() => { setRecording(!recording); if (!recording) setPlaying(true); }}
        size={54}
      />
      <TransportButton
        icon={<Repeat className="w-4 h-4" />}
        active={looping}
        onClick={() => setLooping(!looping)}
      />

      {/* Right: BPM and countdown */}
      <div className="studio-panel-raised rounded px-3 py-1.5 flex items-center gap-3 ml-6">
        <div className="flex flex-col items-center">
          <span className="text-[7px] text-studio-text-dim uppercase tracking-wider">BPM</span>
          <span className="studio-readout text-sm">140</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex flex-col items-center">
          <span className="text-[7px] text-studio-text-dim uppercase tracking-wider">Key</span>
          <span className="studio-readout text-sm">C min</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${recording ? "bg-studio-record animate-record-pulse" : "bg-studio-metal-light"}`} />
          <span className="text-[8px] text-studio-text-dim uppercase">
            {recording ? "Recording" : "Idle"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TransportControls;
