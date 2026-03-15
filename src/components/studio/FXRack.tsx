import RotaryKnob from "./RotaryKnob";
import ToggleSwitch from "./ToggleSwitch";
import { useStudioStore } from "@/studio/engine/studioStore";
import type { EffectsState } from "@/studio/types/studio";

type FXId = keyof Omit<EffectsState, "masterVolume">;

const moduleLabels: { id: FXId; name: string }[] = [
  { id: "compressor", name: "Compressor" },
  { id: "delay", name: "Delay" },
  { id: "reverb", name: "Reverb" },
  { id: "eq", name: "EQ" },
  { id: "limiter", name: "Limiter" },
];

const FXRack = () => {
  const effects = useStudioStore((s) => s.effects);
  const setEffectActive = useStudioStore((s) => s.setEffectActive);
  const setEffectParam = useStudioStore((s) => s.setEffectParam);
  const setMasterVolume = useStudioStore((s) => s.setMasterVolume);

  return (
    <div className="studio-panel w-[160px] shrink-0 flex flex-col overflow-hidden">
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

      {/* Signal chain indicator */}
      <div className="px-3 py-1.5 border-b border-border flex items-center gap-1 flex-wrap">
        {["Mic", "Comp", "Dly", "Rev", "EQ", "Lim", "Out"].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-1">
            <span className="text-[7px] text-studio-text-dim uppercase tracking-wider">{s}</span>
            {i < arr.length - 1 && <span className="text-[8px] text-studio-teal">→</span>}
          </span>
        ))}
      </div>

      {/* FX Modules */}
      <div className="flex-1 overflow-y-auto">
        {moduleLabels.map(({ id, name }) => {
          const mod = effects[id];
          const active = mod.active;

          return (
            <div
              key={id}
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
                  onChange={() => setEffectActive(id, !active)}
                  size="sm"
                />
              </div>

              {/* ── Compressor ── */}
              {id === "compressor" && (
                <div className="flex justify-center">
                  <RotaryKnob
                    value={mod.params.amount}
                    onChange={(v) => setEffectParam(id, "amount", v)}
                    size={44}
                    label="Amount"
                    active={active}
                  />
                </div>
              )}

              {/* ── Delay ── */}
              {id === "delay" && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-1">
                    {["1/4", "1/8", "1/16"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setEffectParam(id, "time", t)}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-all ${
                          effects.delay.time === t
                            ? "bg-studio-teal/20 text-studio-teal border border-studio-teal/30"
                            : "bg-studio-metal text-studio-text-dim border border-border"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <RotaryKnob
                    value={mod.params.mix}
                    onChange={(v) => setEffectParam(id, "mix", v)}
                    size={44}
                    label="Mix"
                    active={active}
                    glowColor="blue"
                  />
                </div>
              )}

              {/* ── Reverb ── */}
              {id === "reverb" && (
                <div className="flex gap-2 justify-center">
                  <RotaryKnob
                    value={mod.params.size}
                    onChange={(v) => setEffectParam(id, "size", v)}
                    size={38}
                    label="Size"
                    active={active}
                    glowColor="blue"
                  />
                  <RotaryKnob
                    value={mod.params.mix}
                    onChange={(v) => setEffectParam(id, "mix", v)}
                    size={38}
                    label="Mix"
                    active={active}
                    glowColor="blue"
                  />
                </div>
              )}

              {/* ── EQ ── */}
              {id === "eq" && (
                <div className="flex gap-1.5 justify-center">
                  <RotaryKnob
                    value={mod.params.low}
                    onChange={(v) => setEffectParam(id, "low", v)}
                    size={32}
                    label="Low"
                    active={active}
                    glowColor="blue"
                  />
                  <RotaryKnob
                    value={mod.params.mid}
                    onChange={(v) => setEffectParam(id, "mid", v)}
                    size={32}
                    label="Mid"
                    active={active}
                  />
                  <RotaryKnob
                    value={mod.params.high}
                    onChange={(v) => setEffectParam(id, "high", v)}
                    size={32}
                    label="High"
                    active={active}
                    glowColor="blue"
                  />
                </div>
              )}

              {/* ── Limiter ── */}
              {id === "limiter" && (
                <div className="flex gap-2 justify-center">
                  <RotaryKnob
                    value={mod.params.ceiling}
                    onChange={(v) => setEffectParam(id, "ceiling", v)}
                    size={38}
                    label="Ceil"
                    active={active}
                  />
                  <RotaryKnob
                    value={mod.params.gain}
                    onChange={(v) => setEffectParam(id, "gain", v)}
                    size={38}
                    label="Gain"
                    active={active}
                  />
                </div>
              )}
            </div>
          );
        })}

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
              value={effects.masterVolume}
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
