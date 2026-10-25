import { useCallback, useEffect, useRef, useState } from "react";
import { Settings, Mic, Volume2, Clock, HardDrive, Monitor } from "lucide-react";
import * as Tone from "tone";
import { toast } from "sonner";
import StudioModal from "./StudioModal";
import { useAudioInputDevices } from "@/hooks/use-audio-inputs";
import { audioEngine, supportsOutputDeviceSelection } from "@/audio/AudioEngine";
import { resetAudioEngine } from "@/studio/commands/projectCommands";
import { getLatencyEstimate } from "@/studio/engine/transportEngine";
import { openCaptureStream, type CaptureReport } from "@/audio/captureConstraints";
import { persistenceService } from "@/studio/persistence";
import {
  useStudioSettings,
  gridDivisionOptions,
  autosaveIntervalOptions,
  type GridDivision,
  type AutosaveInterval,
} from "@/studio/settings/studioSettings";

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

const SelectRow = <T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) => (
  <div className="flex items-center justify-between gap-3 py-2 px-3">
    {label && <span className="text-xs text-studio-text-dim shrink-0">{label}</span>}
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-studio-metal border border-border rounded px-2 py-1 text-xs text-foreground outline-none min-w-0 flex-1 max-w-[260px] disabled:opacity-50"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

/** A feature that is not built yet — shown so users know it is planned, but not interactive. */
const ComingSoonRow = ({ label }: { label: string }) => (
  <div className="w-full flex items-center justify-between py-2 px-3 text-xs text-studio-text-dim/60">
    <span>{label}</span>
    <span className="text-[9px] uppercase tracking-wider">Coming soon</span>
  </div>
);

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="px-3 text-[10px] text-studio-text-dim leading-relaxed">{children}</p>
);

const ActionButton = ({ label, onClick, variant = "default", disabled = false }: { label: string; onClick: () => void; variant?: "default" | "teal"; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-3 py-1.5 rounded text-xs font-medium transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${
      variant === "teal"
        ? "border-studio-teal/40 bg-studio-teal/15 text-studio-teal hover:bg-studio-teal/25"
        : "border-border bg-studio-metal text-studio-text-dim hover:text-foreground hover:border-studio-metal-light"
    }`}
  >
    {label}
  </button>
);

/** Live mic level + optional monitoring, using the audio engine's context so it follows the output device. */
function useMicTest(deviceId: string | null) {
  const [testing, setTesting] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [levelDb, setLevelDb] = useState(-Infinity);
  const [report, setReport] = useState<CaptureReport | null>(null);
  const nodes = useRef<{ stream: MediaStream; source: MediaStreamAudioSourceNode; analyser: AnalyserNode; raf: number } | null>(null);

  const stop = useCallback(() => {
    const n = nodes.current;
    if (n) {
      cancelAnimationFrame(n.raf);
      n.source.disconnect();
      n.stream.getTracks().forEach((t) => t.stop());
      nodes.current = null;
    }
    setTesting(false);
    setMonitoring(false);
    setLevelDb(-Infinity);
  }, []);

  const start = useCallback(async () => {
    try {
      await audioEngine.init();
      // Same constraints as recording, so the meter and report reflect real capture
      const { stream, report: captureReport } = await openCaptureStream(deviceId, false);
      setReport(captureReport);
      const ctx = Tone.getContext().rawContext as AudioContext;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        // Peak (not RMS) so the reading shows how close the input is to clipping
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v));
        setLevelDb(peak > 0 ? 20 * Math.log10(peak) : -Infinity);
        if (nodes.current) nodes.current.raf = requestAnimationFrame(tick);
      };
      nodes.current = { stream, source, analyser, raf: requestAnimationFrame(tick) };
      setTesting(true);
    } catch (err) {
      toast.error("Could not open the microphone", { description: err instanceof Error ? err.message : undefined });
      stop();
    }
  }, [deviceId, stop]);

  const toggleMonitor = useCallback(() => {
    const n = nodes.current;
    if (!n) return;
    const ctx = Tone.getContext().rawContext as AudioContext;
    if (monitoring) {
      n.source.disconnect(ctx.destination);
    } else {
      n.source.connect(ctx.destination);
    }
    setMonitoring(!monitoring);
  }, [monitoring]);

  // Restart on device change; always release the mic when the modal closes
  useEffect(() => stop, [deviceId, stop]);

  return { testing, monitoring, levelDb, report, start, stop, toggleMonitor };
}

const SettingsModal = ({ open, onClose }: SettingsModalProps) => (
  <StudioModal
    open={open}
    onClose={onClose}
    title="Settings"
    icon={<Settings className="w-4 h-4 text-studio-teal" />}
    width="560px"
  >
    {/* Rendered only while open, so device enumeration (which asks for mic permission) waits until needed */}
    <SettingsContent />
  </StudioModal>
);

const SettingsContent = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("audio");
  const settings = useStudioSettings();
  const { updateSettings } = settings;

  const { devices: inputs, error: inputError, refresh } = useAudioInputDevices();
  const [outputs, setOutputs] = useState<{ deviceId: string; label: string }[]>([]);

  // Output labels are only exposed after mic permission, so re-list whenever inputs refresh
  useEffect(() => {
    if (!supportsOutputDeviceSelection) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) =>
        setOutputs(
          all
            .filter((d) => d.kind === "audiooutput" && d.deviceId !== "default")
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Output ${i + 1}` })),
        ),
      )
      .catch(() => setOutputs([]));
  }, [inputs]);

  const mic = useMicTest(settings.inputDeviceId);
  const micPercent = Number.isFinite(mic.levelDb) ? Math.max(0, Math.min(100, ((mic.levelDb + 60) / 60) * 100)) : 0;

  const handleOutputChange = async (value: string) => {
    const deviceId = value || null;
    updateSettings({ outputDeviceId: deviceId });
    if (!audioEngine.contextStarted) return; // applied when audio starts
    try {
      await audioEngine.setOutputDevice(deviceId);
    } catch (err) {
      toast.error("Could not switch output device", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const testSpeakers = async () => {
    await audioEngine.init();
    const osc = new Tone.Oscillator(440, "sine").toDestination();
    osc.volume.value = -15;
    osc.start();
    osc.stop("+0.6");
    setTimeout(() => osc.dispose(), 1000);
  };

  const handleResetEngine = () => {
    mic.stop();
    resetAudioEngine();
    toast.success("Audio engine reset");
  };

  const handleAutosaveChange = (value: AutosaveInterval) => {
    updateSettings({ autosaveInterval: value });
    if (persistenceService.currentHandle) persistenceService.startAutosave();
  };

  const location = persistenceService.storageLocation;
  const latency = getLatencyEstimate(mic.report?.latency);

  return (
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
        <div className="flex-1 min-w-0 min-h-[320px]">
          {activeTab === "audio" && (
            <div className="space-y-4">
              <div>
                <SectionLabel>Default Input Device</SectionLabel>
                <SelectRow
                  label=""
                  value={settings.inputDeviceId ?? ""}
                  options={[{ value: "", label: "Browser default" }, ...inputs.map((d) => ({ value: d.deviceId, label: d.label }))]}
                  onChange={(v) => updateSettings({ inputDeviceId: v || null })}
                />
                <Hint>
                  {inputError ?? "Used for recording on tracks that don't have their own input selected."}
                </Hint>
              </div>

              <div>
                <SectionLabel>Output Device</SectionLabel>
                <SelectRow
                  label=""
                  value={settings.outputDeviceId ?? ""}
                  options={[{ value: "", label: "System default" }, ...outputs.map((d) => ({ value: d.deviceId, label: d.label }))]}
                  onChange={handleOutputChange}
                  disabled={!supportsOutputDeviceSelection}
                />
                {!supportsOutputDeviceSelection && (
                  <Hint>This browser can't choose an output device; it uses the system default.</Hint>
                )}
              </div>

              <div>
                <SectionLabel>Mic Level</SectionLabel>
                <div className="flex items-center gap-3 px-3 py-2">
                  <Mic className={`w-3.5 h-3.5 ${mic.testing ? "text-studio-teal" : "text-studio-text-dim"}`} />
                  <div className="flex-1 h-2 rounded-full bg-studio-metal overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-studio-teal to-studio-blue transition-[width] duration-75"
                      style={{ width: `${micPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-studio-text-dim w-16 text-right">
                    {mic.testing && Number.isFinite(mic.levelDb) ? `${Math.round(mic.levelDb)} dBFS` : "—"}
                  </span>
                </div>
                {mic.report && (
                  <Hint>
                    {mic.report.processingActive.length === 0
                      ? `Clean capture: echo cancellation, noise suppression and auto gain are off${mic.report.sampleRate ? ` · ${mic.report.sampleRate} Hz` : ""}.`
                      : `This browser kept ${mic.report.processingActive.join(", ")} on for this device — recordings may sound processed.`}
                  </Hint>
                )}
              </div>

              <div>
                <SectionLabel>Actions</SectionLabel>
                <div className="flex flex-wrap gap-2 px-3">
                  <ActionButton label={mic.testing ? "Stop Mic Test" : "Test Mic"} onClick={mic.testing ? mic.stop : mic.start} variant="teal" />
                  <ActionButton
                    label={mic.monitoring ? "Stop Monitoring" : "Monitor Mic"}
                    onClick={mic.toggleMonitor}
                    disabled={!mic.testing}
                  />
                  <ActionButton label="Test Speakers" onClick={testSpeakers} />
                  <ActionButton label="Reconnect Devices" onClick={refresh} />
                  <ActionButton label="Reset Audio Engine" onClick={handleResetEngine} />
                </div>
                <Hint>Use headphones when monitoring to avoid feedback.</Hint>
              </div>
            </div>
          )}

          {activeTab === "recording" && (
            <div className="space-y-2">
              <SectionLabel>Recording Options</SectionLabel>
              <ToggleRow label="Metronome during playback & recording" checked={settings.metronome} onChange={(v) => updateSettings({ metronome: v })} />
              <Hint>The click goes to your speakers only — it is never recorded or exported.</Hint>
              <ComingSoonRow label="Count-in before recording" />
              <ToggleRow label="Record in stereo" checked={settings.recordStereo} onChange={(v) => updateSettings({ recordStereo: v })} />
              <Hint>Off (mono) suits most vocal and instrument mics. Takes are saved as lossless 32-bit float WAV.</Hint>

              <div className="pt-2">
                <SectionLabel>Monitoring</SectionLabel>
                <ToggleRow
                  label="Hear input through track FX while recording"
                  checked={settings.monitorInputThroughFX}
                  onChange={(v) => updateSettings({ monitorInputThroughFX: v })}
                />
                <Hint>
                  Only what you hear goes through the FX — the recorded take is always the dry, original signal. Use headphones.
                  {latency && ` Estimated delay you'll hear: ~${Math.round((latency.base + latency.output + latency.input) * 1000)} ms (output ${Math.round((latency.base + latency.output) * 1000)} ms + input ${Math.round(latency.input * 1000)} ms, plus FX).`}
                </Hint>
              </div>

              <div className="pt-2">
                <SectionLabel>Latency Compensation</SectionLabel>
                <div className="flex items-center justify-between gap-3 py-2 px-3">
                  <span className="text-xs text-studio-text-dim">Extra offset (ms)</span>
                  <input
                    type="number"
                    min={-500}
                    max={500}
                    step={1}
                    value={settings.recordingOffsetMs}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) updateSettings({ recordingOffsetMs: Math.max(-500, Math.min(500, Math.round(v))) });
                    }}
                    className="w-20 bg-studio-metal border border-border rounded px-2 py-1 text-xs text-foreground outline-none text-right"
                  />
                </div>
                <Hint>
                  Takes are shifted earlier by the latency the browser reports. If takes still land late, increase this; if early, decrease it.
                </Hint>
              </div>

              <div className="pt-2">
                <SectionLabel>Recording Behavior</SectionLabel>
                <Hint>New recordings are added as a new clip; existing clips are never replaced.</Hint>
                <ComingSoonRow label="Replace / take lanes on overlap" />
              </div>
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="space-y-2">
              <SectionLabel>Grid & Snap</SectionLabel>
              <ToggleRow label="Snap to grid in new sessions" checked={settings.snapByDefault} onChange={(v) => updateSettings({ snapByDefault: v })} />
              <SelectRow<GridDivision>
                label="Grid division"
                value={settings.gridDivision}
                options={gridDivisionOptions}
                onChange={(v) => updateSettings({ gridDivision: v })}
              />
              <Hint>Toggle snapping for the current session with G or View → Snap to Grid / Free Move.</Hint>
              <div className="pt-2">
                <SectionLabel>Playback</SectionLabel>
                <ToggleRow label="Auto-scroll during playback" checked={settings.autoScroll} onChange={(v) => updateSettings({ autoScroll: v })} />
              </div>
            </div>
          )}

          {activeTab === "storage" && (
            <div className="space-y-4">
              <div>
                <SectionLabel>Current Session</SectionLabel>
                <div className="px-3 py-2 rounded border border-border bg-studio-metal">
                  <span className="text-xs text-studio-text-dim font-mono">{location?.label ?? "No session open"}</span>
                </div>
                <Hint>
                  Where a session is stored is chosen when you create it (File → New Session). Use File → Save Session As to copy it somewhere else.
                </Hint>
              </div>
              <div>
                <SectionLabel>Autosave</SectionLabel>
                <SelectRow<AutosaveInterval>
                  label="Interval"
                  value={settings.autosaveInterval}
                  options={autosaveIntervalOptions.map(({ value, label }) => ({ value, label }))}
                  onChange={handleAutosaveChange}
                />
                {settings.autosaveInterval === "off" && (
                  <Hint>Autosave is off — only Ctrl+S, recordings and imports save your session.</Hint>
                )}
              </div>
            </div>
          )}

          {activeTab === "interface" && (
            <div className="space-y-2">
              <SectionLabel>Display Options</SectionLabel>
              <ToggleRow label="Always show track meters" checked={settings.showTrackMeters} onChange={(v) => updateSettings({ showTrackMeters: v })} />
              <ToggleRow label="Show FX badges on track headers" checked={settings.showFXBadges} onChange={(v) => updateSettings({ showFXBadges: v })} />
            </div>
          )}
        </div>
      </div>
  );
};

export default SettingsModal;
