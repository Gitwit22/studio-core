import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEduMe } from "./EduProtectedRoute";

type NavItem = { id: string; label: string; path: string };

export default function EduSidebar() {
  const nav = useNavigate();
  const loc = useLocation();
  const me = useEduMe();

  const role = String(me?.orgRole || me?.role || "viewer");
  const schoolName = String(me?.orgName || "Your School");
  const isFacultyAdmin = role === "faculty_admin";

  const items = useMemo<NavItem[]>(
    () => [
      { id: "dashboard", label: "Dashboard", path: "/streamline/edu/dashboard" },
      { id: "broadcast", label: "Broadcast", path: "/streamline/edu/broadcast" },
      { id: "events", label: "Events", path: "/streamline/edu/events" },
      { id: "archive", label: "Archive", path: "/streamline/edu/archive" },
      { id: "people", label: "People", path: "/streamline/edu/people" },
      { id: "embed", label: "Website Embed", path: "/streamline/edu/embed" },
      ...(isFacultyAdmin ? [{ id: "settings", label: "Settings", path: "/streamline/edu/settings" }] : []),
    ],
    [isFacultyAdmin]
  );

  return (
    <nav className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-slate-800/50 bg-slate-950">
      <div className="border-b border-slate-800/50 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <div className="font-bold tracking-tight text-white">StreamLine</div>
            <div className="text-xs font-semibold tracking-widest text-orange-400">EDU</div>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-800/50 bg-slate-900/30 px-6 py-4">
        <div className="mb-1 text-xs uppercase tracking-wider text-slate-500">School</div>
        <div className="text-sm font-medium text-white">{schoolName}</div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {items.map((item) => {
          const active = loc.pathname === item.path;
          return (
            <button
              key={item.id}
              onClick={() => nav(item.path)}
              className={`w-full px-6 py-3 text-left transition-colors ${
                active
                  ? "border-r-2 border-orange-500 bg-orange-500/10 text-orange-400"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-800/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-sm font-semibold text-white">
            {String(me?.displayName || "EDU")
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p: string) => p[0]?.toUpperCase())
              .join("") || "ED"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{String(me?.displayName || "User")}</div>
            <div className="text-xs text-slate-500">{role}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
