import { ReactNode } from "react";

interface TransportButtonProps {
  icon: ReactNode;
  active?: boolean;
  variant?: "default" | "record" | "play";
  onClick?: () => void;
  size?: number;
}

/**
 * Round transport control. Inactive buttons are neutral raised surfaces; an active
 * play button fills with the accent gradient and an active record button fills red,
 * so transport state is readable at a glance.
 */
const TransportButton = ({ icon, active = false, variant = "default", onClick, size = 48 }: TransportButtonProps) => {
  const baseStyles =
    "rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 select-none border";

  let stateStyles: string;
  let background: string | undefined;

  if (active && variant === "record") {
    stateStyles =
      "border-studio-record text-white shadow-[0_0_0_3px_hsl(var(--studio-record)/0.2),0_6px_24px_-4px_hsl(var(--studio-record)/0.7)] animate-record-pulse";
    background = "linear-gradient(180deg, hsl(354 92% 66%), hsl(354 80% 52%))";
  } else if (active && variant === "play") {
    stateStyles =
      "border-transparent text-primary-foreground shadow-[0_0_0_3px_hsl(var(--studio-glow-teal)/0.18),0_6px_24px_-4px_hsl(var(--studio-glow-teal)/0.7)]";
    background = "var(--accent-gradient)";
  } else if (active) {
    stateStyles =
      "border-studio-teal/50 text-studio-teal bg-studio-teal/15 shadow-[0_0_14px_-2px_hsl(var(--studio-glow-teal)/0.5)]";
  } else {
    stateStyles = `border-studio-line-strong bg-studio-metal hover:bg-studio-metal-light hover:text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_2px_6px_hsl(0_0%_0%/0.4)] ${
      variant === "record" ? "text-studio-record" : "text-studio-text-dim"
    }`;
  }

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${stateStyles}`}
      style={{ width: size, height: size, background }}
    >
      {icon}
    </button>
  );
};

export default TransportButton;
