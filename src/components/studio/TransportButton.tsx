import { ReactNode } from "react";

interface TransportButtonProps {
  icon: ReactNode;
  active?: boolean;
  variant?: "default" | "record" | "play";
  onClick?: () => void;
  size?: number;
}

const TransportButton = ({ icon, active = false, variant = "default", onClick, size = 48 }: TransportButtonProps) => {
  const baseStyles = "rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 select-none";

  const variantStyles = {
    default: active
      ? "shadow-[0_0_12px_hsl(172_72%_55%/0.3)] border-studio-teal/30"
      : "",
    record: active
      ? "shadow-[0_0_20px_hsl(0_100%_62%/0.4)] border-studio-record/50"
      : "",
    play: active
      ? "shadow-[0_0_12px_hsl(172_72%_55%/0.3)] border-studio-teal/30"
      : "",
  };

  const iconColor = {
    default: active ? "text-studio-teal" : "text-studio-text-dim",
    record: active ? "text-studio-record" : "text-studio-text-dim",
    play: active ? "text-studio-teal" : "text-studio-text-dim",
  };

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${active && variant === "record" ? "animate-record-pulse" : ""}`}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 40% 35%, hsl(220 15% 20%), hsl(220 15% 10%))",
        border: `2px solid ${active && variant === "record" ? "hsl(0 100% 62% / 0.5)" : active ? "hsl(172 72% 55% / 0.3)" : "hsl(220 15% 22%)"}`,
        boxShadow: `inset 0 2px 4px hsl(0 0% 0% / 0.3), 0 2px 8px hsl(0 0% 0% / 0.4)${active && variant === "record" ? ", 0 0 20px hsl(0 100% 62% / 0.3)" : active ? ", 0 0 12px hsl(172 72% 55% / 0.2)" : ""}`,
      }}
    >
      <span className={iconColor[variant]}>{icon}</span>
    </button>
  );
};

export default TransportButton;
