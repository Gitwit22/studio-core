import { Save, Download, Mic, AudioWaveform } from "lucide-react";
import VUMeter from "./VUMeter";
import { useStudioStore } from "@/studio/engine/studioStore";
import { runCommand } from "@/studio/commandBus";

const ConsoleBar = () => {
  const projectName = useStudioStore((s) => s.projectName);
  const isRecording = useStudioStore((s) => s.isRecording);

  return (
    <div className="studio-panel h-12 flex items-center justify-between px-3 shrink-0">
      {/* Left: Brand */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shadow-[0_4px_14px_-4px_hsl(var(--studio-glow-teal)/0.7)]"
          style={{ background: "var(--accent-gradient)" }}
        >
          <AudioWaveform className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-semibold text-sm tracking-tight text-foreground">StreamLine</span>
          <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-studio-text-dim mt-0.5">
            Music Studio
          </span>
        </div>
      </div>

      {/* Center: Session info */}
      <div className="flex items-center gap-2 studio-well rounded-full pl-3 pr-1 py-1">
        <span className="text-[10px] uppercase tracking-wider text-studio-text-dim">Session</span>
        <span className="text-xs font-medium text-foreground max-w-[260px] truncate" title={projectName}>
          {projectName}
        </span>
        <div
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 ${
            isRecording ? "bg-studio-record/15" : "bg-studio-ok/10"
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isRecording
                ? "bg-studio-record shadow-[0_0_6px_hsl(var(--studio-record))] animate-record-pulse"
                : "bg-studio-ok shadow-[0_0_6px_hsl(var(--studio-ok))]"
            }`}
          />
          <span
            className={`text-[9px] font-semibold uppercase tracking-wider ${
              isRecording ? "text-studio-record" : "text-studio-ok"
            }`}
          >
            {isRecording ? "Recording" : "Ready"}
          </span>
        </div>
      </div>

      {/* Right: Mic meter + actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 studio-well px-2.5 py-1 rounded-lg">
          <Mic className="w-3 h-3 text-studio-teal" />
          <VUMeter bars={12} active={isRecording} height={18} vertical={false} />
        </div>
        <div className="w-px h-6 bg-border mx-1" />
        <button onClick={() => runCommand("project:save")} className="studio-icon-btn w-8 h-8" title="Save">
          <Save className="w-4 h-4" />
        </button>
        <button onClick={() => runCommand("project:export")} className="studio-icon-btn w-8 h-8" title="Export">
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ConsoleBar;
