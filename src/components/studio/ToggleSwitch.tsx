interface ToggleSwitchProps {
  active: boolean;
  onChange?: (active: boolean) => void;
  label?: string;
  activeColor?: "teal" | "red" | "blue";
  size?: "sm" | "md";
}

const ToggleSwitch = ({ active, onChange, label, activeColor = "teal", size = "md" }: ToggleSwitchProps) => {
  const colors = {
    teal: { bg: "bg-studio-teal", shadow: "shadow-[0_0_8px_hsl(172_72%_55%/0.5)]" },
    red: { bg: "bg-studio-record", shadow: "shadow-[0_0_8px_hsl(0_100%_62%/0.5)]" },
    blue: { bg: "bg-studio-blue", shadow: "shadow-[0_0_8px_hsl(217_100%_71%/0.5)]" },
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
            : "bg-studio-metal"
        }`}
        style={{
          boxShadow: active ? undefined : "inset 0 2px 4px hsl(0 0% 0% / 0.5)",
        }}
      >
        <div
          className={`${dims.dot} rounded-full absolute top-0.5 left-0.5 transition-transform duration-150 ${
            active ? dims.translate : "translate-x-0"
          }`}
          style={{
            background: active
              ? "radial-gradient(circle at 35% 35%, hsl(0 0% 100% / 0.9), hsl(0 0% 80%))"
              : "radial-gradient(circle at 35% 35%, hsl(220 15% 30%), hsl(220 15% 18%))",
            boxShadow: "0 1px 3px hsl(0 0% 0% / 0.4)",
          }}
        />
      </button>
    </div>
  );
};

export default ToggleSwitch;
