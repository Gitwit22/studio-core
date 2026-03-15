import { useState } from "react";
import { Settings, Mic, Volume2, Clock, HardDrive, Monitor, RefreshCw } from "lucide-react";
import StudioModal from "./StudioModal";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = "audio" | "recording" | "timeline" | "storage" | "interface";

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "audio", label: "Audio", icon: <Volume2 className="w-3.5 h-3.5" /> },
  { id: "recording", label: "Recording", icon: <Mic className="w-3.5 h-3.5" /> },
  { id: "timeline", label: "Timeline", icon: <Clock className="w-3.5 h-3.5" /> },
  { id: "storage", label: "Storage", icon: <HardDrive className="w-3.5 h-3.5" /> },
  { id: "interface", label: "Interface", icon: <Monitor className="w-3.5 h-3.5" /> },
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] uppercase tracking-widest text-studio-text-dim font-semibold mb-2 block">
    {children}
  </label>
);

const ToggleRow = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className="w-full flex items-center justify-between py-2 px-3 rounded text-xs text-studio-text-dim hover:text-foreground hover:bg-studio-metal/50 transition-colors"
  >
    <span>{label}</span>
    <div
      className={`w-8 h-4 rounded-full transition-all relative ${
        checked ? "bg-studio-teal/30" : "bg-studio-metal"
      }`}
    >
      <div
        className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
          checked ? "left-4 bg-studio-teal shadow-[0_0_6px_hsl(172_72%_55%/0.5)]" : "left-0.5 bg-gray-500"
        }`}
      />
    </div>
  </button>
);

const SelectRow = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between py-2 px-3">
    <span className="text-xs text-studio-text-dim">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-studio-metal border border-border rounded px-2 py-1 text-xs text-foreground outline-none"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

const ActionButton = ({ label, onClick, variant = "default" }: { label: string; onClick: () => void; variant?: "default" | "teal" }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded text-xs font-medium transition-all border ${
      variant === "teal"
        ? "border-studio-teal/40 bg-studio-teal/15 text-studio-teal hover:bg-studio-teal/25"
        : "border-border bg-studio-metal text-studio-text-dim hover:text-foreground hover:border-studio-metal-light"
    }`}
  >
    {label}
  </button>
);

const SettingsModal = ({ open, onClose }: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("audio");

  // Audio settings
  const [inputDevice, setInputDevice] = useState("Default Microphone");
  const [outputDevice, setOutputDevice] = useState("Default Speakers");

  // Recording settings
  const [countIn, setCountIn] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [autoMonitor, setAutoMonitor] = useState(true);
  const [recordBehavior, setRecordBehavior] = useState("Replace");

  // Timeline settings
  const [snapDefault, setSnapDefault] = useState(true);
  const [gridDivision, setGridDivision] = useState("1/4 Beat");
  const [autoScroll, setAutoScroll] = useState(true);
  const [dragBehavior, setDragBehavior] = useState("Snap to Grid");

  // Storage settings
  const [storageMode, setStorageMode] = useState("Local");
  const [autosaveInterval, setAutosaveInterval] = useState("30 seconds");

  // Interface settings
  const [showTrackMeters, setShowTrackMeters] = useState(true);
  const [showFXBadges, setShowFXBadges] = useState(true);
  const [compactMixer, setCompactMixer] = useState(false);

  return (
    <StudioModal
      open={open}
      onClose={onClose}
      title="Settings"
      icon={<Settings className="w-4 h-4 text-studio-teal" />}
      width="560px"
    >
      <div className="flex gap-4">
        {/* Tab sidebar */}
        <div className="flex flex-col gap-1 min-w-[120px]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded text-xs transition-all text-left ${
                activeTab === tab.id
                  ? "bg-studio-teal/15 text-studio-teal border border-studio-teal/30"
                  : "text-studio-text-dim hover:text-foreground hover:bg-studio-metal/50 border border-transparent"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-[320px]">
          {activeTab === "audio" && (
            <div className="space-y-4">
              <div>
                <SectionLabel>Input Device</SectionLabel>
                <SelectRow
                  label=""
                  value={inputDevice}
                  options={["Default Microphone", "Built-in Microphone", "USB Audio Interface"]}
                  onChange={setInputDevice}
                />
              </div>

              <div>
                <SectionLabel>Output Device</SectionLabel>
                <SelectRow
                  label=""
                  value={outputDevice}
                  options={["Default Speakers", "Built-in Speakers", "Headphones", "USB Audio Interface"]}
                  onChange={setOutputDevice}
                />
              </div>

              <div>
                <SectionLabel>Mic Level</SectionLabel>
                <div className="flex items-center gap-3 px-3 py-2">
                  <Mic className="w-3.5 h-3.5 text-studio-teal" />
                  <div className="flex-1 h-2 rounded-full bg-studio-metal overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-studio-teal to-studio-blue"
                      style={{ width: "35%" }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-studio-text-dim">-18dB</span>
                </div>
              </div>

              <div>
                <SectionLabel>Actions</SectionLabel>
                <div className="flex flex-wrap gap-2 px-3">
                  <ActionButton label="Test Mic" onClick={() => console.log("Test mic")} variant="teal" />
                  <ActionButton label="Monitor Mic" onClick={() => console.log("Monitor mic")} />
                  <ActionButton label="Test Speakers" onClick={() => console.log("Test speakers")} />
                  <ActionButton label="Reconnect Devices" onClick={() => console.log("Reconnect devices")} />
                  <ActionButton
                    label="Reset Audio Engine"
                    onClick={() => console.log("Reset audio engine")}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "recording" && (
            <div className="space-y-2">
              <SectionLabel>Recording Options</SectionLabel>
              <ToggleRow label="Count-in before recording" checked={countIn} onChange={setCountIn} />
              <ToggleRow label="Metronome" checked={metronome} onChange={setMetronome} />
              <ToggleRow label="Auto-monitor while armed" checked={autoMonitor} onChange={setAutoMonitor} />
              <div className="pt-2">
                <SectionLabel>Recording Behavior</SectionLabel>
                <SelectRow
                  label="On overlap"
                  value={recordBehavior}
                  options={["Replace", "Layer", "Create New Take"]}
                  onChange={setRecordBehavior}
                />
              </div>
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="space-y-2">
              <SectionLabel>Grid &amp; Snap</SectionLabel>
              <ToggleRow label="Snap to grid by default" checked={snapDefault} onChange={setSnapDefault} />
              <SelectRow
                label="Grid division"
                value={gridDivision}
                options={["1 Bar", "1/2 Beat", "1/4 Beat", "1/8 Beat", "1/16 Beat"]}
                onChange={setGridDivision}
              />
              <div className="pt-2">
                <SectionLabel>Playback</SectionLabel>
                <ToggleRow label="Auto-scroll during playback" checked={autoScroll} onChange={setAutoScroll} />
              </div>
              <div className="pt-2">
                <SectionLabel>Drag Behavior</SectionLabel>
                <SelectRow
                  label="Default mode"
                  value={dragBehavior}
                  options={["Snap to Grid", "Free Move"]}
                  onChange={setDragBehavior}
                />
              </div>
            </div>
          )}

          {activeTab === "storage" && (
            <div className="space-y-4">
              <div>
                <SectionLabel>Storage Mode</SectionLabel>
                <SelectRow
                  label="Mode"
                  value={storageMode}
                  options={["Local", "Cloud"]}
                  onChange={setStorageMode}
                />
              </div>
              <div>
                <SectionLabel>Save Location</SectionLabel>
                <div className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-studio-metal">
                  <span className="text-xs text-studio-text-dim font-mono flex-1 truncate">
                    ~/StreamLine/Sessions
                  </span>
                  <ActionButton label="Change" onClick={() => console.log("Change save location")} />
                </div>
              </div>
              <div>
                <SectionLabel>Actions</SectionLabel>
                <div className="flex gap-2 px-3">
                  <ActionButton
                    label="Reconnect Folder"
                    onClick={() => console.log("Reconnect folder")}
                  />
                </div>
              </div>
              <div>
                <SectionLabel>Autosave</SectionLabel>
                <SelectRow
                  label="Interval"
                  value={autosaveInterval}
                  options={["Off", "15 seconds", "30 seconds", "1 minute", "5 minutes"]}
                  onChange={setAutosaveInterval}
                />
              </div>
            </div>
          )}

          {activeTab === "interface" && (
            <div className="space-y-2">
              <SectionLabel>Display Options</SectionLabel>
              <ToggleRow label="Always show track meters" checked={showTrackMeters} onChange={setShowTrackMeters} />
              <ToggleRow label="Show FX badges on track headers" checked={showFXBadges} onChange={setShowFXBadges} />
              <ToggleRow label="Compact mixer (placeholder)" checked={compactMixer} onChange={setCompactMixer} />
            </div>
          )}
        </div>
      </div>
    </StudioModal>
  );
};

export default SettingsModal;
