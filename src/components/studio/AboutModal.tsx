import { Info, ExternalLink } from "lucide-react";
import StudioModal from "./StudioModal";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

const AboutModal = ({ open, onClose }: AboutModalProps) => {
  return (
    <StudioModal
      open={open}
      onClose={onClose}
      title="About"
      icon={<Info className="w-4 h-4 text-studio-teal" />}
      width="400px"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-studio-teal shadow-[0_0_12px_hsl(172_72%_55%/0.5)]" />
          <span className="text-lg font-bold tracking-wide text-foreground">
            StreamLine
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-studio-text-dim mt-1">
            Music Studio
          </span>
        </div>

        {/* Version */}
        <div className="studio-readout text-xs px-3 py-1 rounded bg-studio-metal border border-border">
          Version 1.0.0
        </div>

        {/* Company */}
        <p className="text-xs text-studio-text-dim">
          Built by <span className="text-foreground font-medium">Nxt Lvl Technology Solutions</span>
        </p>

        {/* Description */}
        <p className="text-xs text-studio-text-dim leading-relaxed max-w-[300px]">
          A browser-based digital audio workstation for recording, editing, and mixing music. 
          Built with modern web audio technology.
        </p>

        {/* Links */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => console.log("Release notes")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border border-border bg-studio-metal text-studio-text-dim hover:text-foreground hover:border-studio-metal-light transition-all"
          >
            <ExternalLink className="w-3 h-3" />
            Release Notes
          </button>
          <button
            onClick={() => console.log("Website")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border border-border bg-studio-metal text-studio-text-dim hover:text-foreground hover:border-studio-metal-light transition-all"
          >
            <ExternalLink className="w-3 h-3" />
            Website
          </button>
          <button
            onClick={() => console.log("Support")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border border-studio-teal/40 bg-studio-teal/15 text-studio-teal hover:bg-studio-teal/25 transition-all"
          >
            Support
          </button>
        </div>
      </div>
    </StudioModal>
  );
};

export default AboutModal;
