import { useEffect, useRef, useState, useCallback } from "react";
import {
  AudioMixer,
  ALL_BUS_IDS,
  BUS_LABELS,
  type BusId,
  type MixerState,
} from "../../lib/audioMixer";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AudioMixerModalProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Singleton mixer instance (lives for the lifetime of the tab)
// ---------------------------------------------------------------------------

let _mixerInstance: AudioMixer | null = null;

export function getMixer(): AudioMixer {
  if (!_mixerInstance) _mixerInstance = new AudioMixer();
  return _mixerInstance;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AudioMixerModal({ open, onClose }: AudioMixerModalProps) {
  const mixer = useRef(getMixer()).current;
  const [state, setState] = useState<MixerState>(() => mixer.getState());

  // Subscribe to mixer state updates
  useEffect(() => {
    const unsub = mixer.subscribe(setState);
    return unsub;
  }, [mixer]);

  // Initialise AudioContext on first open (requires user gesture)
  useEffect(() => {
    if (open) mixer.init();
  }, [open, mixer]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleGain = useCallback(
    (busId: BusId, v: number) => mixer.setGain(busId, v),
    [mixer],
  );
  const handleMute = useCallback(
    (busId: BusId) => {
      const cur = state.buses[busId].muted;
      mixer.setMuted(busId, !cur);
    },
    [mixer, state],
  );
  const handleSolo = useCallback(
    (busId: BusId) => {
      const cur = state.buses[busId].solo;
      mixer.setSolo(busId, !cur);
    },
    [mixer, state],
  );
  const handleOutputToggle = useCallback(
    (busId: BusId, output: "monitor" | "program") => {
      const cur = state.buses[busId].outputs[output];
      mixer.setOutputFlag(busId, output, !cur);
    },
    [mixer, state],
  );

  if (!open) return null;

  const inputBuses = ALL_BUS_IDS.filter((id) => id !== "masterBus");

  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        right: "420px",
        zIndex: 51,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: "460px",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          background: "rgba(20, 20, 20, 0.98)",
          border: "1px solid rgba(139, 92, 246, 0.5)",
          borderRadius: "0.75rem",
          boxShadow: "0 20px 60px rgba(139, 92, 246, 0.2)",
          backdropFilter: "blur(20px)",
          color: "#e5e7eb",
        }}
      >
        {/* ---- Header ---- */}
        <div
          style={{
            padding: "0.75rem 1rem",
            background:
              "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(168,85,247,0.06))",
            borderBottom: "2px solid rgba(139,92,246,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#a78bfa",
              }}
            >
              🎛️ Audio Mixer
            </div>
            <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginTop: 2 }}>
              Monitor &amp; Program outputs
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(139,92,246,0.15)",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: "0.4rem",
              color: "#c4b5fd",
              cursor: "pointer",
              padding: "0.25rem 0.55rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              lineHeight: 1,
            }}
            aria-label="Close mixer"
          >
            ✕
          </button>
        </div>

        {/* ---- Content ---- */}
        <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>

          {/* Output header labels */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 60px 60px",
              gap: "0.4rem",
              alignItems: "center",
              paddingBottom: "0.25rem",
              borderBottom: "1px solid rgba(55,65,81,0.6)",
            }}
          >
            <span style={{ fontSize: "0.65rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Bus
            </span>
            <span
              style={{
                fontSize: "0.6rem",
                color: "#34d399",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textAlign: "center",
              }}
            >
              Monitor
            </span>
            <span
              style={{
                fontSize: "0.6rem",
                color: "#f87171",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textAlign: "center",
              }}
            >
              Program
            </span>
          </div>

          {/* ---- Input buses ---- */}
          {inputBuses.map((busId) => (
            <BusStrip
              key={busId}
              busId={busId}
              bus={state.buses[busId]}
              onGain={handleGain}
              onMute={handleMute}
              onSolo={handleSolo}
              onOutputToggle={handleOutputToggle}
            />
          ))}

          {/* ---- Divider ---- */}
          <div style={{ borderTop: "1px solid rgba(139,92,246,0.25)", margin: "0.15rem 0" }} />

          {/* ---- Master bus ---- */}
          <BusStrip
            busId="masterBus"
            bus={state.buses.masterBus}
            onGain={handleGain}
            onMute={handleMute}
            onSolo={handleSolo}
            onOutputToggle={handleOutputToggle}
            isMaster
          />

          {/* ---- Output gains ---- */}
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginTop: "0.25rem",
              padding: "0.6rem",
              background: "rgba(15,23,42,0.7)",
              borderRadius: "0.4rem",
              border: "1px solid rgba(55,65,81,0.5)",
            }}
          >
            <OutputFader
              label="Monitor"
              color="#34d399"
              value={state.monitorGain}
              onChange={(v) => mixer.setMonitorGain(v)}
            />
            <OutputFader
              label="Program"
              color="#f87171"
              value={state.programGain}
              onChange={(v) => mixer.setProgramGain(v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BusStrip sub-component
// ---------------------------------------------------------------------------

interface BusStripProps {
  busId: BusId;
  bus: MixerState["buses"][BusId];
  onGain: (id: BusId, v: number) => void;
  onMute: (id: BusId) => void;
  onSolo: (id: BusId) => void;
  onOutputToggle: (id: BusId, output: "monitor" | "program") => void;
  isMaster?: boolean;
}

function BusStrip({
  busId,
  bus,
  onGain,
  onMute,
  onSolo,
  onOutputToggle,
  isMaster,
}: BusStripProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 60px 60px",
        gap: "0.4rem",
        alignItems: "center",
        padding: "0.5rem",
        background: isMaster
          ? "rgba(139,92,246,0.06)"
          : "rgba(15,23,42,0.5)",
        borderRadius: "0.4rem",
        border: isMaster
          ? "1px solid rgba(139,92,246,0.25)"
          : "1px solid rgba(55,65,81,0.4)",
      }}
    >
      {/* Left column: label + gain slider + mute/solo */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: isMaster ? "#c4b5fd" : "#e5e7eb",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              minWidth: 70,
            }}
          >
            {BUS_LABELS[busId]}
          </span>

          {/* Mute */}
          <button
            onClick={() => onMute(busId)}
            title={bus.muted ? "Unmute" : "Mute"}
            style={{
              width: 26,
              height: 22,
              fontSize: "0.6rem",
              fontWeight: 700,
              borderRadius: "0.25rem",
              border: "none",
              cursor: "pointer",
              background: bus.muted ? "#dc2626" : "rgba(55,65,81,0.7)",
              color: bus.muted ? "#fff" : "#9ca3af",
            }}
          >
            M
          </button>

          {/* Solo */}
          <button
            onClick={() => onSolo(busId)}
            title={bus.solo ? "Unsolo" : "Solo"}
            style={{
              width: 26,
              height: 22,
              fontSize: "0.6rem",
              fontWeight: 700,
              borderRadius: "0.25rem",
              border: "none",
              cursor: "pointer",
              background: bus.solo ? "#eab308" : "rgba(55,65,81,0.7)",
              color: bus.solo ? "#000" : "#9ca3af",
            }}
          >
            S
          </button>

          <span
            style={{
              fontSize: "0.6rem",
              color: "#6b7280",
              marginLeft: "auto",
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {Math.round(bus.gain * 100)}%
          </span>
        </div>

        {/* Gain slider */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={bus.gain}
          onChange={(e) => onGain(busId, Number(e.target.value))}
          style={{
            width: "100%",
            height: 4,
            accentColor: isMaster ? "#a78bfa" : "#6366f1",
            cursor: "pointer",
          }}
          aria-label={`${BUS_LABELS[busId]} gain`}
        />
      </div>

      {/* Monitor output toggle */}
      <div style={{ textAlign: "center" }}>
        <button
          onClick={() => onOutputToggle(busId, "monitor")}
          title={`Send to monitor: ${bus.outputs.monitor ? "ON" : "OFF"}`}
          style={{
            width: 32,
            height: 22,
            fontSize: "0.55rem",
            fontWeight: 700,
            borderRadius: "0.25rem",
            border: "none",
            cursor: "pointer",
            background: bus.outputs.monitor ? "#059669" : "rgba(55,65,81,0.5)",
            color: bus.outputs.monitor ? "#fff" : "#6b7280",
          }}
        >
          MON
        </button>
      </div>

      {/* Program output toggle */}
      <div style={{ textAlign: "center" }}>
        <button
          onClick={() => onOutputToggle(busId, "program")}
          title={`Send to program: ${bus.outputs.program ? "ON" : "OFF"}`}
          style={{
            width: 32,
            height: 22,
            fontSize: "0.55rem",
            fontWeight: 700,
            borderRadius: "0.25rem",
            border: "none",
            cursor: "pointer",
            background: bus.outputs.program ? "#dc2626" : "rgba(55,65,81,0.5)",
            color: bus.outputs.program ? "#fff" : "#6b7280",
          }}
        >
          PGM
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OutputFader sub-component
// ---------------------------------------------------------------------------

interface OutputFaderProps {
  label: string;
  color: string;
  value: number;
  onChange: (v: number) => void;
}

function OutputFader({ label, color, value, onChange }: OutputFaderProps) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: "0.65rem", fontWeight: 600, color, textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ fontSize: "0.6rem", color: "#6b7280" }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          height: 4,
          accentColor: color,
          cursor: "pointer",
        }}
        aria-label={`${label} output gain`}
      />
    </div>
  );
}
