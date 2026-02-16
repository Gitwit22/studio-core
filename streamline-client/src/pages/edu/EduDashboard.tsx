import { useMemo, useState } from "react";

type Props = {
  me: any;
};

function titleForPage(page: string) {
  switch (page) {
    case "dashboard":
      return { title: "Dashboard", subtitle: "Overview" };
    case "broadcast":
      return { title: "Broadcast", subtitle: "Go live and manage your stream" };
    case "events":
      return { title: "Events", subtitle: "Schedule and manage school broadcasts" };
    case "archive":
      return { title: "Archive", subtitle: "Recordings and past broadcasts" };
    case "people":
      return { title: "People", subtitle: "Roles and crew" };
    case "embed":
      return { title: "Website Embed", subtitle: "Embed your HLS stream" };
    case "settings":
      return { title: "Settings", subtitle: "School configuration" };
    default:
      return { title: "EDU", subtitle: null as string | null };
  }
}

export default function EduDashboard({ me }: Props) {
  const [currentPage, setCurrentPage] = useState<string>("dashboard");
  const [isLive] = useState<boolean>(false);

  const role = String(me?.orgRole || me?.role || "viewer");
  const schoolName = String(me?.orgName || me?.org?.name || "Your School");

  const isFacultyAdmin = role === "faculty_admin";

  // Sample data (placeholder until wired to backend)
  const upcomingEvents = useMemo(
    () => [
      {
        id: 1,
        title: "Morning Announcements",
        time: "8:00 AM",
        date: "Today",
        type: "announcement" as const,
        crew: ["Alex M.", "Jordan K."],
      },
      {
        id: 2,
        title: "Winter Concert",
        time: "7:00 PM",
        date: "Dec 18",
        type: "event" as const,
        crew: ["Sarah L.", "Mike T.", "Emma R."],
      },
      {
        id: 3,
        title: "Basketball Game",
        time: "6:30 PM",
        date: "Dec 20",
        type: "event" as const,
        crew: ["Chris B.", "Taylor S."],
      },
    ],
    []
  );

  const recentRecordings = useMemo(
    () => [
      { id: 1, title: "Morning Announcements - Dec 13", duration: "12:34", date: "2 hours ago" },
      { id: 2, title: "Band Practice Session", duration: "45:12", date: "Yesterday" },
      { id: 3, title: "Principal Address", duration: "8:45", date: "3 days ago" },
      { id: 4, title: "Fall Play - Act 1", duration: "1:23:45", date: "Dec 8" },
    ],
    []
  );

  const navItems = useMemo(
    () =>
      [
        { id: "dashboard", label: "Dashboard" },
        { id: "broadcast", label: "Broadcast" },
        { id: "events", label: "Events" },
        { id: "archive", label: "Archive" },
        { id: "people", label: "People" },
        { id: "embed", label: "Website Embed" },
        ...(isFacultyAdmin ? [{ id: "settings", label: "Settings" }] : []),
      ] as Array<{ id: string; label: string }>,
    [isFacultyAdmin]
  );

  const { title, subtitle } = titleForPage(currentPage);

  const Navigation = () => (
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
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full px-6 py-3 text-left transition-colors ${
              currentPage === item.id
                ? "border-r-2 border-orange-500 bg-orange-500/10 text-orange-400"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
            }`}
          >
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {isLive && (
        <div className="mx-4 mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-semibold text-red-400">LIVE NOW</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">Morning Announcements</div>
        </div>
      )}

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

  const TopBar = ({ title, subtitle }: { title: string; subtitle?: string | null }) => (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-800/50 bg-slate-900/50 px-6 backdrop-blur-xl">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-4">
        {isLive && (
          <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-semibold text-red-400">LIVE</span>
            <span className="text-sm text-slate-400">• 127 viewers</span>
          </div>
        )}
        <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </button>
      </div>
    </header>
  );

  const DashboardPage = () => (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div
          className={`rounded-2xl border p-5 ${
            isLive ? "border-red-500/30 bg-red-500/10" : "border-slate-800/50 bg-slate-900/50"
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-400">Broadcast Status</span>
            {isLive ? <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" /> : null}
          </div>
          <div className={`text-2xl font-bold ${isLive ? "text-red-400" : "text-slate-500"}`}>
            {isLive ? "LIVE" : "OFF AIR"}
          </div>
          {isLive ? <div className="mt-1 text-sm text-slate-400">127 viewers • 12:34 elapsed</div> : null}
        </div>

        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5">
          <div className="mb-3 text-sm text-slate-400">Next Scheduled</div>
          <div className="text-xl font-bold text-white">Morning Announcements</div>
          <div className="mt-1 text-sm text-orange-400">Tomorrow • 8:00 AM</div>
        </div>

        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5">
          <div className="mb-3 text-sm text-slate-400">Recordings This Month</div>
          <div className="text-2xl font-bold text-white">24</div>
          <div className="mt-1 text-sm text-emerald-400">↑ 8 from last month</div>
        </div>

        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5">
          <div className="mb-3 text-sm text-slate-400">Active Students</div>
          <div className="text-2xl font-bold text-white">12</div>
          <div className="mt-1 text-sm text-slate-400">3 producers • 9 talent</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button className="group rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-6 text-left transition-colors hover:from-orange-400 hover:to-amber-500">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 transition-transform group-hover:scale-110">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="text-xl font-bold text-white">Start Broadcast</div>
          <div className="mt-1 text-sm text-orange-100/80">Go live to your school network</div>
        </button>

        <button className="group rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 text-left transition-colors hover:border-slate-700 hover:bg-slate-800/50">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 transition-transform group-hover:scale-110">
            <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="text-xl font-bold text-white">Schedule Event</div>
          <div className="mt-1 text-sm text-slate-400">Plan upcoming broadcasts</div>
        </button>

        <button className="group rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 text-left transition-colors hover:border-slate-700 hover:bg-slate-800/50">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 transition-transform group-hover:scale-110">
            <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <div className="text-xl font-bold text-white">Website Embed</div>
          <div className="mt-1 text-sm text-slate-400">Get code for your site</div>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Upcoming Events</h3>
            <button onClick={() => setCurrentPage("events")} className="text-sm text-orange-400 hover:text-orange-300">
              View All →
            </button>
          </div>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="rounded-xl bg-slate-800/50 p-4 transition-colors hover:bg-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-white">{event.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {event.date} • {event.time}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          event.type === "announcement" ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"
                        }`}
                      >
                        {event.type === "announcement" ? "Announcement" : "Event"}
                      </span>
                      <span className="text-xs text-slate-500">{event.crew.length} crew assigned</span>
                    </div>
                  </div>
                  <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Recent Recordings</h3>
            <button onClick={() => setCurrentPage("archive")} className="text-sm text-orange-400 hover:text-orange-300">
              View All →
            </button>
          </div>
          <div className="space-y-3">
            {recentRecordings.map((recording) => (
              <div
                key={recording.id}
                className="flex items-center gap-4 rounded-xl bg-slate-800/50 p-4 transition-colors hover:bg-slate-800"
              >
                <div className="flex h-10 w-16 items-center justify-center rounded-lg bg-slate-700">
                  <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-white">{recording.title}</div>
                  <div className="text-sm text-slate-400">
                    {recording.duration} • {recording.date}
                  </div>
                </div>
                <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
            <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <div className="font-medium text-amber-300">Storage Notice</div>
            <div className="mt-1 text-sm text-slate-400">
              You&apos;ve used 78% of your recording storage this month. Consider archiving older recordings.
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const PlaceholderPage = () => (
    <div className="p-6">
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/40 p-6 text-sm text-slate-400">
        This section is a placeholder in EDU MVP.
      </div>
    </div>
  );

  const content = currentPage === "dashboard" ? <DashboardPage /> : <PlaceholderPage />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation />
      <div className="ml-64 min-h-screen">
        <TopBar title={title} subtitle={subtitle} />
        {content}
      </div>
    </div>
  );
}
