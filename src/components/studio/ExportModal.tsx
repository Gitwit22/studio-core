import { useState, useEffect } from "react";
import { X, Download, FileAudio, Check } from "lucide-react";
import { runCommand } from "@/studio/commandBus";
import { useStudioStore } from "@/studio/engine/studioStore";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

const ExportModal = ({ open, onClose }: ExportModalProps) => {
  const [format, setFormat] = useState("WAV");
  const [bitDepth, setBitDepth] = useState("24");
  const [sampleRate, setSampleRate] = useState("48000");
  const [exportType, setExportType] = useState("master");
  const projectName = useStudioStore((s) => s.projectName);
  const [fileName, setFileName] = useState(projectName || "Untitled Session");
  const [normalize, setNormalize] = useState(true);
  const [includeEffects, setIncludeEffects] = useState(true);
  const [includeAutomation, setIncludeAutomation] = useState(true);
  const [silencePadding, setSilencePadding] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!rendering) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setRendering(false);
            setProgress(0);
            onClose();
          }, 500);
          return 100;
        }
        return p + Math.random() * 8 + 2;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [rendering, onClose]);

  if (!open) return null;

  const formats = ["WAV", "MP3", "FLAC"];
  const bitDepths = ["16", "24", "32"];
  const sampleRates = ["44100", "48000"];
  const exportTypes = [
    { value: "master", label: "Master Mix" },
    { value: "tracks", label: "Individual Tracks" },
    { value: "stems", label: "Stems" },
    { value: "video", label: "Video" },
  ];

  const ToggleOption = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-[11px] text-studio-text-dim hover:text-foreground transition-colors"
    >
      <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${
        checked ? "bg-studio-teal/20 border-studio-teal" : "border-border bg-studio-metal"
      }`}>
        {checked && <Check className="w-2.5 h-2.5 text-studio-teal" />}
      </div>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative studio-panel rounded-lg w-[420px] max-h-[85vh] overflow-y-auto shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-studio-teal" />
            <span className="text-sm font-semibold uppercase tracking-wider text-foreground">Export Project</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-studio-metal transition-colors">
            <X className="w-4 h-4 text-studio-text-dim" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Format */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-studio-text-dim font-semibold mb-2 block">Format</label>
            <div className="flex gap-2">
              {formats.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border ${
                    format === f
                      ? "bg-studio-teal/15 text-studio-teal border-studio-teal/40 shadow-[0_0_12px_hsl(172_72%_55%/0.15)]"
                      : "bg-studio-metal text-studio-text-dim border-border hover:border-studio-metal-light"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Bit Depth */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-studio-text-dim font-semibold mb-2 block">Quality</label>
            <div className="flex gap-2">
              {bitDepths.map((b) => (
                <button
                  key={b}
                  onClick={() => setBitDepth(b)}
                  className={`flex-1 py-2 rounded text-xs font-mono transition-all border ${
                    bitDepth === b
                      ? "bg-studio-blue/15 text-studio-blue border-studio-blue/40"
                      : "bg-studio-metal text-studio-text-dim border-border hover:border-studio-metal-light"
                  }`}
                >
                  {b} bit
                </button>
              ))}
            </div>
          </div>

          {/* Sample Rate */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-studio-text-dim font-semibold mb-2 block">Sample Rate</label>
            <div className="flex gap-2">
              {sampleRates.map((s) => (
                <button
                  key={s}
                  onClick={() => setSampleRate(s)}
                  className={`flex-1 py-2 rounded text-xs font-mono transition-all border ${
                    sampleRate === s
                      ? "bg-studio-blue/15 text-studio-blue border-studio-blue/40"
                      : "bg-studio-metal text-studio-text-dim border-border hover:border-studio-metal-light"
                  }`}
                >
                  {Number(s).toLocaleString()} Hz
                </button>
              ))}
            </div>
          </div>

          {/* Export Type */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-studio-text-dim font-semibold mb-2 block">Export Type</label>
            <div className="space-y-1.5">
              {exportTypes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setExportType(t.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs transition-all border ${
                    exportType === t.value
                      ? "bg-studio-teal/10 text-studio-teal border-studio-teal/30"
                      : "bg-studio-metal text-studio-text-dim border-border hover:border-studio-metal-light"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                    exportType === t.value ? "border-studio-teal" : "border-muted-foreground"
                  }`}>
                    {exportType === t.value && <div className="w-1.5 h-1.5 rounded-full bg-studio-teal" />}
                  </div>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* File Name */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-studio-text-dim font-semibold mb-2 block">File Name</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-studio-metal">
              <FileAudio className="w-3.5 h-3.5 text-studio-text-dim shrink-0" />
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground"
              />
              <span className="text-[9px] font-mono text-muted-foreground">.{format.toLowerCase()}</span>
            </div>
          </div>

          {/* Advanced */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[10px] uppercase tracking-widest text-studio-text-dim font-semibold hover:text-foreground transition-colors"
            >
              {showAdvanced ? "▾" : "▸"} Advanced
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-2.5 pl-2">
                <ToggleOption checked={normalize} onChange={setNormalize} label="Normalize Output" />
                <ToggleOption checked={includeEffects} onChange={setIncludeEffects} label="Include Effects" />
                <ToggleOption checked={includeAutomation} onChange={setIncludeAutomation} label="Include Automation" />
                <ToggleOption checked={silencePadding} onChange={setSilencePadding} label="Include Silence Padding" />
              </div>
            )}
          </div>

          {/* Render Progress */}
          {rendering && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-studio-teal font-semibold">Rendering...</span>
                <span className="text-xs font-mono text-studio-teal">{Math.min(Math.round(progress), 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-studio-metal overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    background: "linear-gradient(90deg, hsl(172 72% 55%), hsl(217 100% 71%))",
                    boxShadow: "0 0 12px hsl(172 72% 55% / 0.4)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setRendering(true); runCommand("project:export"); }}
              disabled={rendering}
              className="flex-1 py-2.5 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-studio-teal/40 bg-studio-teal/15 text-studio-teal hover:bg-studio-teal/25 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_hsl(172_72%_55%/0.1)]"
            >
              {rendering ? "Rendering..." : "Render"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-border bg-studio-metal text-studio-text-dim hover:text-foreground hover:border-studio-metal-light"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
