import { useState, useRef, useEffect } from "react";
import {
  File, Scissors, Eye, Music2, Sparkles, Download, HelpCircle,
  Plus, FolderOpen, Save, FileDown, Settings, X,
  Undo2, Redo, Copy, Clipboard, SplitSquareHorizontal, Trash2,
  ZoomIn, ZoomOut, LayoutGrid, Sliders, Grid3x3,
  Mic, FileAudio, PenLine,
  BookOpen, Keyboard, Info
} from "lucide-react";

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  separator?: boolean;
  action?: () => void;
}

interface MenuGroup {
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

interface TopMenuProps {
  onExport?: () => void;
}

const TopMenu = ({ onExport }: TopMenuProps) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const menus: MenuGroup[] = [
    {
      label: "FILE",
      icon: <File className="w-3 h-3" />,
      items: [
        { label: "New Session", icon: <Plus className="w-3.5 h-3.5" />, shortcut: "⌘N" },
        { label: "Open Session", icon: <FolderOpen className="w-3.5 h-3.5" />, shortcut: "⌘O" },
        { label: "separator", separator: true },
        { label: "Save", icon: <Save className="w-3.5 h-3.5" />, shortcut: "⌘S" },
        { label: "Save As...", icon: <Save className="w-3.5 h-3.5" />, shortcut: "⇧⌘S" },
        { label: "separator", separator: true },
        { label: "Import Audio", icon: <FileDown className="w-3.5 h-3.5" />, shortcut: "⌘I" },
        { label: "Project Settings", icon: <Settings className="w-3.5 h-3.5" /> },
        { label: "separator", separator: true },
        { label: "Close", icon: <X className="w-3.5 h-3.5" />, shortcut: "⌘W" },
      ],
    },
    {
      label: "EDIT",
      icon: <Scissors className="w-3 h-3" />,
      items: [
        { label: "Undo", icon: <Undo2 className="w-3.5 h-3.5" />, shortcut: "⌘Z" },
        { label: "Redo", icon: <Redo className="w-3.5 h-3.5" />, shortcut: "⇧⌘Z" },
        { label: "separator", separator: true },
        { label: "Cut", icon: <Scissors className="w-3.5 h-3.5" />, shortcut: "⌘X" },
        { label: "Copy", icon: <Copy className="w-3.5 h-3.5" />, shortcut: "⌘C" },
        { label: "Paste", icon: <Clipboard className="w-3.5 h-3.5" />, shortcut: "⌘V" },
        { label: "separator", separator: true },
        { label: "Split Clip", icon: <SplitSquareHorizontal className="w-3.5 h-3.5" />, shortcut: "S" },
        { label: "Delete Clip", icon: <Trash2 className="w-3.5 h-3.5" />, shortcut: "⌫" },
      ],
    },
    {
      label: "VIEW",
      icon: <Eye className="w-3 h-3" />,
      items: [
        { label: "Zoom In", icon: <ZoomIn className="w-3.5 h-3.5" />, shortcut: "⌘+" },
        { label: "Zoom Out", icon: <ZoomOut className="w-3.5 h-3.5" />, shortcut: "⌘-" },
        { label: "separator", separator: true },
        { label: "Show Mixer", icon: <Sliders className="w-3.5 h-3.5" />, shortcut: "⌘M" },
        { label: "Show FX Rack", icon: <Sparkles className="w-3.5 h-3.5" />, shortcut: "⌘F" },
        { label: "Toggle Grid", icon: <Grid3x3 className="w-3.5 h-3.5" />, shortcut: "G" },
      ],
    },
    {
      label: "TRACK",
      icon: <Music2 className="w-3 h-3" />,
      items: [
        { label: "Add Track", icon: <Plus className="w-3.5 h-3.5" />, shortcut: "⌘T" },
        { label: "Duplicate Track", icon: <Copy className="w-3.5 h-3.5" />, shortcut: "⌘D" },
        { label: "Rename Track", icon: <PenLine className="w-3.5 h-3.5" /> },
        { label: "Delete Track", icon: <Trash2 className="w-3.5 h-3.5" /> },
        { label: "separator", separator: true },
        { label: "Record Arm", icon: <Mic className="w-3.5 h-3.5" />, shortcut: "R" },
      ],
    },
    {
      label: "FX",
      icon: <Sparkles className="w-3 h-3" />,
      items: [
        { label: "Add Effect", icon: <Plus className="w-3.5 h-3.5" /> },
        { label: "Preset Library", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
        { label: "Effect Chain", icon: <Sliders className="w-3.5 h-3.5" /> },
      ],
    },
    {
      label: "EXPORT",
      icon: <Download className="w-3 h-3" />,
      items: [
        { label: "Export Mix", icon: <FileAudio className="w-3.5 h-3.5" />, shortcut: "⌘E", action: onExport },
        { label: "Export Stems", icon: <FileAudio className="w-3.5 h-3.5" /> },
        { label: "Export Track", icon: <FileAudio className="w-3.5 h-3.5" /> },
        { label: "separator", separator: true },
        { label: "Export Video", icon: <Download className="w-3.5 h-3.5" /> },
        { label: "Render Project", icon: <Download className="w-3.5 h-3.5" />, action: onExport },
      ],
    },
    {
      label: "HELP",
      icon: <HelpCircle className="w-3 h-3" />,
      items: [
        { label: "Shortcuts", icon: <Keyboard className="w-3.5 h-3.5" /> },
        { label: "Documentation", icon: <BookOpen className="w-3.5 h-3.5" /> },
        { label: "separator", separator: true },
        { label: "About StreamLine Studio", icon: <Info className="w-3.5 h-3.5" /> },
      ],
    },
  ];

  return (
    <div ref={menuRef} className="h-7 flex items-center bg-studio-bg border-b border-border px-1 shrink-0 select-none z-50 relative">
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors rounded-sm ${
              openMenu === menu.label
                ? "bg-studio-metal text-studio-teal"
                : "text-studio-text-dim hover:text-foreground hover:bg-studio-metal/50"
            }`}
            onMouseDown={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
          >
            {menu.icon}
            {menu.label}
          </button>

          {openMenu === menu.label && (
            <div className="absolute top-full left-0 mt-0.5 min-w-[200px] rounded-md border border-border bg-popover shadow-xl shadow-black/50 py-1 z-50">
              {menu.items.map((item, i) =>
                item.separator ? (
                  <div key={i} className="h-px mx-2 my-1 bg-border" />
                ) : (
                  <button
                    key={item.label}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-studio-text-dim hover:text-foreground hover:bg-studio-metal/60 transition-colors"
                    onClick={() => {
                      item.action?.();
                      setOpenMenu(null);
                    }}
                  >
                    {item.icon}
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.shortcut && (
                      <span className="text-[9px] font-mono text-muted-foreground opacity-60">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TopMenu;
