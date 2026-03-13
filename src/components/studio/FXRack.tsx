import { useState } from "react";
import RotaryKnob from "./RotaryKnob";
import ToggleSwitch from "./ToggleSwitch";

interface FXModule {
  id: string;
  name: string;
  active: boolean;
  params: { [key: string]: number };
}

const FXRack = () => {
  const [modules, setModules] = useState<FXModule[]>([
    { id: "comp", name: "Compressor", active: true, params: { amount: 65 } },
    { id: "delay", name: "Delay", active: false, params: { time: 50, mix: 30 } },
    { id: "reverb", name: "Reverb", active: true, params: { size: 45, mix: 40 } },
    { id: "eq", name: "EQ", active: true, params: { low: 50, mid: 55, high: 50 } },
    { id: "limiter", name: "Limiter", active: true, params: { ceiling: 75, gain: 50 } },
  ]);

  const [delayTime, setDelayTime] = useState<string>("1/4");

  const toggleModule = (id: string) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, active: !m.active } : m));
  };

  const updateParam = (id: string, param: string, value: number) => {
    setModules(prev => prev.map(m =>
      m.id === id ? { ...m, params: { ...m.params, [param]: value } } : m
    ));
  };

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
        {modules.map((mod) => (
          <div
            key={mod.id}
            className="border-b border-border p-3"
            style={{
              background: mod.active
                ? "linear-gradient(180deg, hsl(172 72% 55% / 0.02), transparent)"
                : undefined,
            }}
          >
            {/* Module header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`studio-led ${mod.active ? "active" : ""}`} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                  {mod.name}
                </span>
              </div>
              <ToggleSwitch
                active={mod.active}
                onChange={() => toggleModule(mod.id)}
                size="sm"
              />
            </div>

            {/* Module controls */}
            {mod.id === "comp" && (
              <div className="flex justify-center">
                <RotaryKnob
                  value={mod.params.amount}
                  onChange={(v) => updateParam(mod.id, "amount", v)}
                  size={44}
                  label="Amount"
                  active={mod.active}
                />
              </div>
            )}

            {mod.id === "delay" && (
              <div className="flex flex-col items-center gap-2">
                {/* Time selector */}
                <div className="flex gap-1">
                  {["1/4", "1/8", "1/16"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setDelayTime(t)}
                      className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-all ${
                        delayTime === t
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
                  onChange={(v) => updateParam(mod.id, "mix", v)}
                  size={44}
                  label="Mix"
                  active={mod.active}
                  glowColor="blue"
                />
              </div>
            )}

            {mod.id === "reverb" && (
              <div className="flex gap-2 justify-center">
                <RotaryKnob
                  value={mod.params.size}
                  onChange={(v) => updateParam(mod.id, "size", v)}
                  size={38}
                  label="Size"
                  active={mod.active}
                  glowColor="blue"
                />
                <RotaryKnob
                  value={mod.params.mix}
                  onChange={(v) => updateParam(mod.id, "mix", v)}
                  size={38}
                  label="Mix"
                  active={mod.active}
                  glowColor="blue"
                />
              </div>
            )}

            {mod.id === "eq" && (
              <div className="flex gap-1.5 justify-center">
                <RotaryKnob
                  value={mod.params.low}
                  onChange={(v) => updateParam(mod.id, "low", v)}
                  size={32}
                  label="Low"
                  active={mod.active}
                  glowColor="blue"
                />
                <RotaryKnob
                  value={mod.params.mid}
                  onChange={(v) => updateParam(mod.id, "mid", v)}
                  size={32}
                  label="Mid"
                  active={mod.active}
                />
                <RotaryKnob
                  value={mod.params.high}
                  onChange={(v) => updateParam(mod.id, "high", v)}
                  size={32}
                  label="High"
                  active={mod.active}
                  glowColor="blue"
                />
              </div>
            )}

            {mod.id === "limiter" && (
              <div className="flex gap-2 justify-center">
                <RotaryKnob
                  value={mod.params.ceiling}
                  onChange={(v) => updateParam(mod.id, "ceiling", v)}
                  size={38}
                  label="Ceil"
                  active={mod.active}
                />
                <RotaryKnob
                  value={mod.params.gain}
                  onChange={(v) => updateParam(mod.id, "gain", v)}
                  size={38}
                  label="Gain"
                  active={mod.active}
                />
              </div>
            )}
          </div>
        ))}

        {/* Output section */}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="studio-led active" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
              Output
            </span>
          </div>
          <div className="flex justify-center">
            <RotaryKnob value={80} size={44} label="Master" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FXRack;
