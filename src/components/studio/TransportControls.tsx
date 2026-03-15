import TransportButton from "./TransportButton";
import { SkipBack, Play, Pause, Square, Circle, Repeat } from "lucide-react";
import { useStudioStore } from "@/studio/engine/studioStore";
import { runCommand } from "@/studio/commandBus";

function formatTimecode(beats: number, bpm: number): string {
  const totalSeconds = (beats / bpm) * 60;
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const frames = Math.floor((totalSeconds % 1) * 30);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

const TransportControls = () => {
  const playing = useStudioStore((s) => s.isPlaying);
  const recording = useStudioStore((s) => s.isRecording);
  const isPaused = useStudioStore((s) => s.isPaused);
  const looping = useStudioStore((s) => s.loop.enabled);
  const bpm = useStudioStore((s) => s.bpm);
  const playhead = useStudioStore((s) => s.playhead);

  const bar = Math.floor(playhead / 4) + 1;

  return (
    <div className="studio-panel h-16 shrink-0 flex items-center justify-center gap-3 px-6">
      {/* Left: Timecode */}
      <div className="studio-panel-raised rounded px-3 py-1.5 flex items-center gap-2 mr-6">
        <span className="studio-readout text-sm tracking-widest">{formatTimecode(playhead, bpm)}</span>
        <div className="w-px h-4 bg-border" />
        <span className="text-[9px] text-studio-text-dim uppercase tracking-wider">Bar {bar}</span>
      </div>

      {/* Transport buttons */}
      <TransportButton
        icon={<SkipBack className="w-4 h-4" />}
        onClick={() => runCommand("transport:rewind")}
      />
      <TransportButton
        icon={playing && !isPaused ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        active={playing && !isPaused}
        variant="play"
        onClick={() => runCommand("transport:play")}
      />
      <TransportButton
        icon={<Square className="w-3.5 h-3.5" />}
        onClick={() => runCommand("transport:stop")}
      />
      <TransportButton
        icon={<Circle className="w-4 h-4" />}
        active={recording}
        variant="record"
        onClick={() => runCommand("transport:record")}
        size={54}
      />
      <TransportButton
        icon={<Repeat className="w-4 h-4" />}
        active={looping}
        onClick={() => {
          useStudioStore.setState((s) => ({
            loop: { ...s.loop, enabled: !s.loop.enabled },
          }));
        }}
      />

      {/* Right: BPM and countdown */}
      <div className="studio-panel-raised rounded px-3 py-1.5 flex items-center gap-3 ml-6">
        <div className="flex flex-col items-center">
          <span className="text-[7px] text-studio-text-dim uppercase tracking-wider">BPM</span>
          <span className="studio-readout text-sm">{bpm}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex flex-col items-center">
          <span className="text-[7px] text-studio-text-dim uppercase tracking-wider">Key</span>
          <span className="studio-readout text-sm">C min</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${recording ? "bg-studio-record animate-record-pulse" : playing ? "bg-studio-teal" : "bg-studio-metal-light"}`} />
          <span className="text-[8px] text-studio-text-dim uppercase">
            {recording ? "Recording" : playing && !isPaused ? "Playing" : isPaused ? "Paused" : "Idle"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TransportControls;
