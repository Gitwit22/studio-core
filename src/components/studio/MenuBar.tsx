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
      className="flex items-center shrink-0 select-none z-50 relative"
      style={{
        height: 32,
        background: "#1a1a1a",
        fontSize: 12,
        borderBottom: "1px solid #333",
      }}
    >
      {studioMenu.map((menu) => {
        const isSettingsMenu = menu.title === "Settings";

        return (
          <div key={menu.title} className="relative">
            <button
              className="px-3 py-1 text-gray-300 hover:text-white transition-colors"
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
                className="absolute top-full left-0 mt-0 min-w-[220px] py-1 rounded shadow-lg z-50"
                style={{ background: "#252525", border: "1px solid #333" }}
              >
                {menu.items.map((item, idx) => {
                  if (item.separator) {
                    return (
                      <div
                        key={`sep-${idx}`}
                        className="my-1 mx-2"
                        style={{ height: 1, background: "#3a3a3a" }}
                      />
                    );
                  }

                  return (
                    <button
                      key={item.action}
                      className="w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors"
                      style={{
                        fontSize: 12,
                        color: item.disabled ? "#666" : undefined,
                        cursor: item.disabled ? "default" : "pointer",
                      }}
                      disabled={item.disabled}
                      onMouseEnter={(e) => {
                        if (!item.disabled) e.currentTarget.style.background = "#3a3a3a";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                      onClick={() => {
                        if (!item.disabled) {
                          runCommand(item.action);
                          setOpenMenu(null);
                        }
                      }}
                    >
                      <span className={item.disabled ? "text-gray-600" : "text-gray-300"}>
                        {item.label}
                      </span>
                      {item.shortcut && (
                        <span
                          className="ml-6 text-gray-500"
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
