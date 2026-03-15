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

  const glowColors = {
    teal: "shadow-[0_0_12px_hsl(172_72%_55%/0.4)]",
    blue: "shadow-[0_0_12px_hsl(217_100%_71%/0.4)]",
    red: "shadow-[0_0_12px_hsl(0_100%_62%/0.4)]",
  };

  const indicatorColors = {
    teal: "bg-studio-teal",
    blue: "bg-studio-blue",
    red: "bg-studio-record",
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && (
        <span className="text-[10px] font-medium uppercase tracking-widest text-studio-text-dim">
          {label}
        </span>
      )}
      <div
        ref={knobRef}
        className={`relative rounded-full cursor-grab active:cursor-grabbing select-none ${active ? glowColors[glowColor] : ""}`}
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
      >
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 180deg, hsl(220 15% 26%), hsl(220 15% 14%), hsl(220 15% 22%), hsl(220 15% 12%), hsl(220 15% 26%))",
            boxShadow: "inset 0 2px 4px hsl(0 0% 0% / 0.5), 0 1px 0 hsl(220 15% 22% / 0.3)",
          }}
        />
        {/* Inner face */}
        <div
          className="absolute rounded-full"
          style={{
            inset: 3,
            background: "radial-gradient(circle at 35% 35%, hsl(220 15% 24%), hsl(220 15% 12%))",
            boxShadow: "inset 0 1px 3px hsl(0 0% 0% / 0.4)",
          }}
        />
        {/* Indicator line */}
        <div
          className="absolute inset-0 flex justify-center"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div
            className={`w-0.5 rounded-full ${active ? indicatorColors[glowColor] : "bg-studio-text-dim"}`}
            style={{ height: size / 2 - 6, marginTop: 4 }}
          />
        </div>
        {/* Center dot */}
        <div
          className="absolute rounded-full"
          style={{
            width: size * 0.2,
            height: size * 0.2,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle at 40% 40%, hsl(220 15% 22%), hsl(220 15% 10%))",
          }}
        />
      </div>
      {/* Value readout */}
      <span className="studio-readout text-[9px]">
        {Math.round(value)}
      </span>
    </div>
  );
};

export default RotaryKnob;
