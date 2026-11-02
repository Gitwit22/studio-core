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
      {/* Ambient backdrop: two soft accent blooms + a faint grid that fades out */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(700px 420px at 30% 20%, hsl(var(--studio-glow-teal) / 0.14), transparent 70%), radial-gradient(640px 420px at 75% 85%, hsl(var(--studio-glow-blue) / 0.12), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--studio-line)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--studio-line)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
      />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center mb-10">
        <div className="relative mb-6">
          <div
            className="absolute -inset-6 rounded-[2.5rem] blur-2xl opacity-50"
            style={{ background: "var(--accent-gradient)" }}
          />
          <div className="relative rounded-[2rem] p-[1px]" style={{ background: "linear-gradient(160deg, hsl(0 0% 100% / 0.25), hsl(0 0% 100% / 0.02) 50%, hsl(var(--studio-glow-teal) / 0.4))" }}>
            <img
              src={logo}
              alt="StreamLine Music Studio"
              className="w-44 h-44 object-contain rounded-[calc(2rem-1px)] bg-black"
            />
          </div>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          StreamLine <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--accent-gradient)" }}>Studio</span>
        </h1>
        <p className="mt-2 text-xs tracking-[0.35em] uppercase text-studio-text-dim font-medium">
          Record · Produce · Deliver
        </p>
      </div>

      {/* Actions */}
      <div className="relative z-10 flex gap-3 mb-10">
        <button
          onClick={() => navigate("/studio")}
          className="studio-btn-primary px-6 py-3 text-sm uppercase tracking-wider"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
        <button
          onClick={() => navigate("/studio")}
          className="flex items-center gap-2.5 px-6 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all border border-studio-line-strong bg-studio-metal/80 backdrop-blur text-foreground/80 hover:text-foreground hover:bg-studio-metal-light shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]"
        >
          <FolderOpen className="w-4 h-4" />
          Open Project
        </button>
        <button
          className="flex items-center gap-2.5 px-6 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all border border-studio-line-strong bg-studio-metal/80 backdrop-blur text-foreground/80 hover:text-foreground hover:bg-studio-metal-light shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]"
        >
          <LayoutGrid className="w-4 h-4" />
          Templates
        </button>
      </div>

      {/* Templates */}
      <div className="relative z-10 grid grid-cols-2 gap-3 w-[520px] max-w-[calc(100vw-32px)]">
        {templates.map((t) => (
          <button
            key={t.name}
            onClick={() => navigate("/studio")}
            className="studio-panel-raised flex items-center gap-3 p-4 rounded-xl text-left transition-all hover:-translate-y-0.5 hover:border-studio-teal/40 hover:shadow-[0_10px_30px_-12px_hsl(var(--studio-glow-teal)/0.5)] group"
          >
            <div className="p-2.5 rounded-lg bg-studio-inset border border-studio-line text-studio-text-dim group-hover:text-studio-teal group-hover:border-studio-teal/30 transition-colors">
              {t.icon}
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{t.name}</div>
              <div className="text-[11px] text-studio-text-dim mt-0.5">{t.desc}</div>
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
