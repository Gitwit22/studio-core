interface ToggleSwitchProps {
  active: boolean;
  onChange?: (active: boolean) => void;
  label?: string;
  activeColor?: "teal" | "red" | "blue";
  size?: "sm" | "md";
}

const ToggleSwitch = ({ active, onChange, label, activeColor = "teal", size = "md" }: ToggleSwitchProps) => {
  const colors = {
    teal: { bg: "bg-studio-teal", shadow: "shadow-[0_0_10px_-1px_hsl(var(--studio-glow-teal)/0.6)]" },
    red: { bg: "bg-studio-record", shadow: "shadow-[0_0_10px_-1px_hsl(var(--studio-record)/0.6)]" },
    blue: { bg: "bg-studio-blue", shadow: "shadow-[0_0_10px_-1px_hsl(var(--studio-glow-blue)/0.6)]" },
  };

  const dims = size === "sm" ? { w: "w-8", h: "h-4", dot: "w-3 h-3", translate: "translate-x-4" } : { w: "w-10", h: "h-5", dot: "w-4 h-4", translate: "translate-x-5" };

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <span className="text-[9px] font-medium uppercase tracking-widest text-studio-text-dim">
          {label}
        </span>
      )}
      <button
        onClick={() => onChange?.(!active)}
        className={`${dims.w} ${dims.h} rounded-full relative transition-all duration-150 ${
          active
            ? `${colors[activeColor].bg} ${colors[activeColor].shadow}`
            : "bg-studio-inset border border-studio-line-strong"
        }`}
        style={{
          boxShadow: active ? undefined : "inset 0 1px 3px hsl(0 0% 0% / 0.6)",
        }}
      >
        <div
          className={`${dims.dot} rounded-full absolute top-0.5 left-0.5 transition-transform duration-150 ${
            active ? dims.translate : "translate-x-0"
          }`}
          style={{
            background: active
              ? "linear-gradient(180deg, hsl(0 0% 100%), hsl(225 20% 88%))"
              : "linear-gradient(180deg, hsl(228 9% 34%), hsl(228 10% 24%))",
            boxShadow: "0 1px 3px hsl(0 0% 0% / 0.4)",
          }}
        />
      </button>
    </div>
  );
};

export default ToggleSwitch;
