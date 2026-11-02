import { useState, useCallback, useRef, useEffect } from "react";

interface RotaryKnobProps {
  value: number; // 0-100
  onChange?: (value: number) => void;
  size?: number;
  label?: string;
  glowColor?: "teal" | "blue" | "red";
  active?: boolean;
}

const RotaryKnob = ({ value, onChange, size = 56, label, glowColor = "teal", active = true }: RotaryKnobProps) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  // Map value (0-100) to rotation (-135 to 135 degrees)
  const rotation = (value / 100) * 270 - 135;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = value;
    e.preventDefault();
  }, [value]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !onChange) return;
      const delta = (startY.current - e.clientY) * 0.5;
      const newValue = Math.round(Math.min(100, Math.max(0, startValue.current + delta)));
      onChange(newValue);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onChange]);

  const accentVar = {
    teal: "--studio-glow-teal",
    blue: "--studio-glow-blue",
    red: "--studio-record",
  }[glowColor];
  const accent = `hsl(var(${accentVar}))`;

  // Value arc geometry: a 270° sweep starting at the 7 o'clock position (-135°).
  const stroke = Math.max(2.5, size * 0.075);
  const radius = size / 2 - stroke / 2 - 0.5;
  const circumference = 2 * Math.PI * radius;
  const sweep = circumference * 0.75;
  const valueLength = sweep * (Math.min(100, Math.max(0, value)) / 100);
  const capInset = stroke + 3;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && (
        <span className="text-[10px] font-medium uppercase tracking-widest text-studio-text-dim">
          {label}
        </span>
      )}
      <div
        ref={knobRef}
        className="relative rounded-full cursor-grab active:cursor-grabbing select-none"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
      >
        {/* Track + value arc */}
        <svg
          className="absolute inset-0 overflow-visible"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
        >
          <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--studio-inset))"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${sweep} ${circumference}`}
            />
            {valueLength > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={active ? accent : "hsl(var(--studio-text-dim) / 0.45)"}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${valueLength} ${circumference}`}
                style={active ? { filter: `drop-shadow(0 0 3px hsl(var(${accentVar}) / 0.6))` } : undefined}
              />
            )}
          </g>
        </svg>
        {/* Cap */}
        <div
          className="absolute rounded-full"
          style={{
            inset: capInset,
            background: "radial-gradient(circle at 50% 30%, hsl(228 10% 26%), hsl(228 11% 15%) 70%)",
            boxShadow:
              "inset 0 1px 0 hsl(0 0% 100% / 0.08), 0 2px 5px hsl(0 0% 0% / 0.55), 0 0 0 1px hsl(0 0% 0% / 0.35)",
          }}
        />
        {/* Pointer */}
        <div
          className="absolute flex justify-center"
          style={{ inset: capInset, transform: `rotate(${rotation}deg)` }}
        >
          <div
            className="rounded-full"
            style={{
              width: 2,
              height: Math.max(4, (size - capInset * 2) * 0.32),
              marginTop: 3,
              background: active ? "hsl(var(--foreground))" : "hsl(var(--studio-text-dim))",
            }}
          />
        </div>
      </div>
      {/* Value readout */}
      <span className="studio-readout text-[9px]">
        {Math.round(value)}
      </span>
    </div>
  );
};

export default RotaryKnob;
