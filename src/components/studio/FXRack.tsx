import RotaryKnob from "./RotaryKnob";
import ToggleSwitch from "./ToggleSwitch";
import { useStudioStore } from "@/studio/engine/studioStore";
import type { FXType, TrackFXSlot } from "@/studio/types/studio";

const moduleLabels: { type: FXType; name: string }[] = [
  { type: "compressor", name: "Compressor" },
  { type: "eq", name: "EQ" },
  { type: "delay", name: "Delay" },
  { type: "reverb", name: "Reverb" },
  { type: "pitchShifter", name: "Pitch Shifter" },
  { type: "limiter", name: "Limiter" },
];

const FXRack = () => {
  const selectedTrackId = useStudioStore((s) => s.selectedTrackId);
  const tracks = useStudioStore((s) => s.tracks);
  const setTrackFXEnabled = useStudioStore((s) => s.setTrackFXEnabled);
  const setTrackFXParam = useStudioStore((s) => s.setTrackFXParam);
  const masterBus = useStudioStore((s) => s.masterBus);
  const setMasterVolume = useStudioStore((s) => s.setMasterVolume);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const fxChain = selectedTrack?.fxChain ?? [];

  const getSlot = (type: FXType): TrackFXSlot | undefined =>
    fxChain.find((f) => f.type === type);

  return (
    <div className="studio-panel h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-studio-text-dim">
          FX Rack
        </span>
        <div className="flex gap-1.5">
          <div className="studio-screw" />
          <div className="studio-screw" />
        </div>
      </div>

      {/* Track indicator */}
      <div className="px-3 py-1.5 border-b border-border">
        <span
          className="text-[9px] font-semibold uppercase tracking-wider"
          style={{ color: selectedTrack?.color ?? "hsl(220 15% 60%)" }}
        >
          {selectedTrack?.name ?? "No track selected"}
        </span>
      </div>

      {/* Signal chain indicator */}
      <div className="px-3 py-1.5 border-b border-border flex items-center gap-1 flex-wrap">
        {["In", "Comp", "EQ", "Dly", "Rev", "Pitch", "Lim", "Out"].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-1">
            <span className="text-[7px] text-studio-text-dim uppercase tracking-wider">{s}</span>
            {i < arr.length - 1 && <span className="text-[8px] text-studio-teal">→</span>}
          </span>
        ))}
      </div>

      {/* FX Modules */}
      <div className="flex-1 overflow-y-auto">
        {selectedTrack ? moduleLabels.map(({ type, name }) => {
          const slot = getSlot(type);
          const active = slot?.enabled ?? false;
          const trackId = selectedTrack.id;

          return (
            <div
              key={type}
              className="border-b border-border p-3"
              style={{
                background: active
                  ? "linear-gradient(180deg, hsl(172 72% 55% / 0.02), transparent)"
                  : undefined,
              }}
            >
              {/* Module header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`studio-led ${active ? "active" : ""}`} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                    {name}
                  </span>
                </div>
                <ToggleSwitch
                  active={active}
                  onChange={() => setTrackFXEnabled(trackId, type, !active)}
                  size="sm"
                />
              </div>

              {/* ── Compressor ── */}
              {type === "compressor" && (
                <div className="flex justify-center">
                  <RotaryKnob
                    value={Number(slot?.params.amount ?? 65)}
                    onChange={(v) => setTrackFXParam(trackId, type, "amount", v)}
                    size={44}
                    label="Amount"
                    active={active}
                  />
                </div>
              )}

              {/* ── Delay ── */}
              {type === "delay" && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-1">
                    {["1/4", "1/8", "1/16"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTrackFXParam(trackId, type, "time", t)}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-all ${
                          String(slot?.params.time) === t
                            ? "bg-studio-teal/20 text-studio-teal border border-studio-teal/30"
                            : "bg-studio-metal text-studio-text-dim border border-border"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <RotaryKnob
                    value={Number(slot?.params.mix ?? 30)}
                    onChange={(v) => setTrackFXParam(trackId, type, "mix", v)}
                    size={44}
                    label="Mix"
                    active={active}
                    glowColor="blue"
                  />
                </div>
              )}

              {/* ── Reverb ── */}
              {type === "reverb" && (
                <div className="flex gap-2 justify-center">
                  <RotaryKnob
                    value={Number(slot?.params.size ?? 45)}
                    onChange={(v) => setTrackFXParam(trackId, type, "size", v)}
                    size={38}
                    label="Size"
                    active={active}
                    glowColor="blue"
                  />
                  <RotaryKnob
                    value={Number(slot?.params.mix ?? 40)}
                    onChange={(v) => setTrackFXParam(trackId, type, "mix", v)}
                    size={38}
                    label="Mix"
                    active={active}
                    glowColor="blue"
                  />
                </div>
              )}

              {/* ── EQ ── */}
              {type === "eq" && (
                <div className="flex gap-1.5 justify-center">
                  <RotaryKnob
                    value={Number(slot?.params.low ?? 50)}
                    onChange={(v) => setTrackFXParam(trackId, type, "low", v)}
                    size={32}
                    label="Low"
                    active={active}
                    glowColor="blue"
                  />
                  <RotaryKnob
                    value={Number(slot?.params.mid ?? 55)}
                    onChange={(v) => setTrackFXParam(trackId, type, "mid", v)}
                    size={32}
                    label="Mid"
                    active={active}
                  />
                  <RotaryKnob
                    value={Number(slot?.params.high ?? 50)}
                    onChange={(v) => setTrackFXParam(trackId, type, "high", v)}
                    size={32}
                    label="High"
                    active={active}
                    glowColor="blue"
                  />
                </div>
              )}

              {/* ── Limiter ── */}
              {type === "limiter" && (
                <div className="flex gap-2 justify-center">
                  <RotaryKnob
                    value={Number(slot?.params.ceiling ?? 75)}
                    onChange={(v) => setTrackFXParam(trackId, type, "ceiling", v)}
                    size={38}
                    label="Ceil"
                    active={active}
                  />
                  <RotaryKnob
                    value={Number(slot?.params.gain ?? 50)}
                    onChange={(v) => setTrackFXParam(trackId, type, "gain", v)}
                    size={38}
                    label="Gain"
                    active={active}
                  />
                </div>
              )}

              {/* ── Pitch Shifter ── */}
              {type === "pitchShifter" && (
                <div className="flex flex-col items-center gap-2">
                  <RotaryKnob
                    value={Number(slot?.params.semitones ?? 50)}
                    onChange={(v) => setTrackFXParam(trackId, type, "semitones", v)}
                    size={44}
                    label="Pitch"
                    active={active}
                    glowColor="blue"
                  />
                  <span className="text-[8px] text-studio-text-dim uppercase tracking-wider">
                    {(() => {
                      const pitch = Math.round(((Number(slot?.params.semitones ?? 50) - 50) / 50) * 12);
                      return `${pitch > 0 ? "+" : ""}${pitch} st`;
                    })()}
                  </span>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="p-3 text-[9px] text-studio-text-dim text-center">
            Select a track to edit FX
          </div>
        )}

        {/* Output section */}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="studio-led active" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
              Output
            </span>
          </div>
          <div className="flex justify-center">
            <RotaryKnob
              value={masterBus.volume}
              onChange={(v) => setMasterVolume(v)}
              size={44}
              label="Master"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FXRack;
