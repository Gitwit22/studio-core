import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface StudioModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  width?: string;
  children: React.ReactNode;
}

const StudioModal = ({ open, onClose, title, icon, width = "420px", children }: StudioModalProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative studio-panel rounded-lg max-h-[85vh] overflow-y-auto shadow-2xl shadow-black/60"
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-semibold uppercase tracking-wider text-foreground">
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-studio-metal transition-colors"
          >
            <X className="w-4 h-4 text-studio-text-dim" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export default StudioModal;
