import { useState, useRef, useEffect } from "react";
import { studioMenu } from "@/config/studioMenu";
import { runCommand } from "@/studio/commandBus";

// Register all commands on import
import "@/studio/commands/projectCommands";
import "@/studio/commands/editCommands";
import "@/studio/commands/transportCommands";
import "@/studio/commands/trackCommands";

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        runCommand("project:save");
        e.preventDefault();
      }

      if (e.code === "Space") {
        // Only trigger if not focused on an input/textarea
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          runCommand("transport:play");
          e.preventDefault();
        }
      }

      if (e.key === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          runCommand("transport:record");
          e.preventDefault();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        runCommand("edit:undo");
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      ref={menuRef}
      className="flex items-center shrink-0 select-none z-50 relative px-1.5 bg-studio-inset border-b border-border"
      style={{ height: 32, fontSize: 12 }}
    >
      {studioMenu.map((menu) => {
        const isSettingsMenu = menu.title === "Settings";

        return (
          <div key={menu.title} className="relative">
            <button
              className={`px-2.5 py-1 rounded-md transition-colors ${
                openMenu === menu.title
                  ? "bg-studio-metal text-foreground"
                  : "text-studio-text-dim hover:text-foreground hover:bg-studio-metal/60"
              }`}
              style={{ fontSize: 12 }}
              onMouseDown={() => {
                if (isSettingsMenu) {
                  runCommand("modal:settings");
                  setOpenMenu(null);
                } else {
                  setOpenMenu(openMenu === menu.title ? null : menu.title);
                }
              }}
              onMouseEnter={() => {
                if (openMenu && !isSettingsMenu) setOpenMenu(menu.title);
              }}
            >
              {menu.title}
            </button>

            {openMenu === menu.title && !isSettingsMenu && (
              <div
                className="absolute top-full left-0 mt-1 min-w-[230px] p-1 rounded-lg z-50 bg-popover border border-studio-line-strong shadow-[0_16px_40px_-12px_hsl(0_0%_0%/0.8)]"
              >
                {menu.items.map((item, idx) => {
                  if (item.separator) {
                    return (
                      <div
                        key={`sep-${idx}`}
                        className="my-1 mx-2 h-px bg-border"
                      />
                    );
                  }

                  return (
                    <button
                      key={item.action}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between transition-colors ${
                        item.disabled ? "cursor-default" : "cursor-pointer hover:bg-studio-teal/15 group/item"
                      }`}
                      style={{ fontSize: 12 }}
                      disabled={item.disabled}
                      onClick={() => {
                        if (!item.disabled) {
                          runCommand(item.action);
                          setOpenMenu(null);
                        }
                      }}
                    >
                      <span className={item.disabled ? "text-studio-text-dim/40" : "text-foreground/90 group-hover/item:text-foreground"}>
                        {item.label}
                      </span>
                      {item.shortcut && (
                        <span
                          className="ml-6 font-mono text-studio-text-dim/70"
                          style={{ fontSize: 10 }}
                        >
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
