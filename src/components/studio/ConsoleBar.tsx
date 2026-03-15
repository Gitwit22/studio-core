import { Save, Settings, Download, Mic } from "lucide-react";
import VUMeter from "./VUMeter";
import { useStudioStore } from "@/studio/engine/studioStore";
import { runCommand } from "@/studio/commandBus";

const ConsoleBar = () => {
  const projectName = useStudioStore((s) => s.projectName);
  const isRecording = useStudioStore((s) => s.isRecording);

  return (
    <div className="studio-panel h-12 flex items-center justify-between px-4 shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-studio-teal shadow-[0_0_8px_hsl(172_72%_55%/0.5)]" />
          <span className="font-semibold text-sm tracking-wide text-foreground">
            StreamLine
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-studio-text-dim">
            Music Studio
          </span>
        </div>
      </div>

      {/* Center: Session info */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-studio-text-dim">Session:</span>
        <span className="studio-readout text-xs">{projectName}</span>
        <div className="flex items-center gap-1.5">
          <div className={`studio-led ${isRecording ? "" : "active"}`} />
          <span className="text-[9px] text-studio-text-dim uppercase tracking-wider">
            {isRecording ? "Recording" : "Ready"}
          </span>
        </div>
      </div>

      {/* Right: Mic meter + actions */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 studio-panel-raised px-3 py-1 rounded">
          <Mic className="w-3 h-3 text-studio-teal" />
          <VUMeter bars={12} active={isRecording} height={20} vertical={false} />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => runCommand("project:save")} className="p-1.5 rounded hover:bg-studio-metal transition-colors" title="Save">
            <Save className="w-3.5 h-3.5 text-studio-text-dim" />
          </button>
          <button onClick={() => runCommand("project:export")} className="p-1.5 rounded hover:bg-studio-metal transition-colors" title="Export">
            <Download className="w-3.5 h-3.5 text-studio-text-dim" />
          </button>
          <button className="p-1.5 rounded hover:bg-studio-metal transition-colors" title="Settings">
            <Settings className="w-3.5 h-3.5 text-studio-text-dim" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsoleBar;
