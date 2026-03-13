import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, LayoutGrid, Mic, Headphones, Music2, Sliders } from "lucide-react";
import logo from "@/assets/streamline-logo.png";

const templates = [
  { name: "Vocal Recording", icon: <Mic className="w-5 h-5" />, desc: "Solo or group vocal session" },
  { name: "Podcast Setup", icon: <Headphones className="w-5 h-5" />, desc: "Multi-host podcast recording" },
  { name: "Beat Production", icon: <Music2 className="w-5 h-5" />, desc: "Instrumental beat workspace" },
  { name: "Full Mix Session", icon: <Sliders className="w-5 h-5" />, desc: "Complete mixing environment" },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background overflow-hidden relative">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-[120px]"
        style={{ background: "radial-gradient(circle, hsl(172 72% 55% / 0.4), hsl(217 100% 71% / 0.2), transparent)" }}
      />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center mb-10">
        <img src={logo} alt="StreamLine Music Studio" className="w-48 h-48 object-contain mb-4 drop-shadow-2xl" />
        <p className="text-sm tracking-[0.3em] uppercase text-studio-text-dim font-medium">
          Record · Produce · Deliver
        </p>
      </div>

      {/* Actions */}
      <div className="relative z-10 flex gap-4 mb-12">
        <button
          onClick={() => navigate("/studio")}
          className="flex items-center gap-2.5 px-6 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all border border-studio-teal/40 bg-studio-teal/10 text-studio-teal hover:bg-studio-teal/20 shadow-[0_0_20px_hsl(172_72%_55%/0.1)]"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
        <button
          onClick={() => navigate("/studio")}
          className="flex items-center gap-2.5 px-6 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all border border-border bg-studio-metal text-studio-text-dim hover:text-foreground hover:border-studio-metal-light"
        >
          <FolderOpen className="w-4 h-4" />
          Open Project
        </button>
        <button
          className="flex items-center gap-2.5 px-6 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all border border-border bg-studio-metal text-studio-text-dim hover:text-foreground hover:border-studio-metal-light"
        >
          <LayoutGrid className="w-4 h-4" />
          Templates
        </button>
      </div>

      {/* Templates */}
      <div className="relative z-10 grid grid-cols-2 gap-3 w-[480px]">
        {templates.map((t) => (
          <button
            key={t.name}
            onClick={() => navigate("/studio")}
            className="studio-panel-raised flex items-center gap-3 p-4 rounded-lg text-left transition-all hover:border-studio-teal/20 group"
          >
            <div className="p-2 rounded-md bg-studio-metal text-studio-text-dim group-hover:text-studio-teal transition-colors">
              {t.icon}
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">{t.name}</div>
              <div className="text-[10px] text-studio-text-dim mt-0.5">{t.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-[10px] text-muted-foreground tracking-wider">
        StreamLine Music Studio v1.0
      </div>
    </div>
  );
};

export default Landing;
