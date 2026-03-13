import { useEffect, useState, useRef } from "react";

interface VUMeterProps {
  bars?: number;
  active?: boolean;
  vertical?: boolean;
  height?: number;
}

const VUMeter = ({ bars = 8, active = true, vertical = true, height = 80 }: VUMeterProps) => {
  const [levels, setLevels] = useState<number[]>(new Array(bars).fill(0));
  const animRef = useRef<number>();

  useEffect(() => {
    if (!active) {
      setLevels(new Array(bars).fill(0));
      return;
    }

    const animate = () => {
      setLevels(prev =>
        prev.map((level) => {
          const target = Math.random() * 0.8 + 0.1;
          return level + (target - level) * 0.3;
        })
      );
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active, bars]);

  const getBarColor = (index: number, level: number) => {
    const ratio = index / bars;
    if (ratio > 0.85) return level > 0.7 ? "bg-studio-record" : "bg-studio-metal-light";
    if (ratio > 0.65) return level > 0.4 ? "bg-yellow-500" : "bg-studio-metal-light";
    return level > 0.1 ? "bg-studio-teal" : "bg-studio-metal-light";
  };

  if (vertical) {
    return (
      <div className="flex gap-px" style={{ height }}>
        <div className="flex flex-col-reverse gap-px w-2">
          {Array.from({ length: bars }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-[1px] transition-all duration-75 ${getBarColor(i, levels[i])}`}
              style={{
                opacity: levels[i] > i / bars ? 1 : 0.2,
                boxShadow: levels[i] > i / bars && i / bars < 0.65
                  ? "0 0 4px hsl(172 72% 55% / 0.3)"
                  : undefined,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-px" style={{ height: height }}>
      {levels.map((level, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-t-sm transition-all duration-75 ${
            i / bars > 0.85 && level > 0.7
              ? "bg-studio-record"
              : i / bars > 0.65 && level > 0.4
              ? "bg-yellow-500"
              : "bg-studio-teal"
          }`}
          style={{
            height: `${level * 100}%`,
            boxShadow: level > 0.3 ? "0 0 4px hsl(172 72% 55% / 0.3)" : undefined,
          }}
        />
      ))}
    </div>
  );
};

export default VUMeter;
