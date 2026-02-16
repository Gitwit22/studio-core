type Props = {
  me: any;
};

export default function EduDashboard({ me }: Props) {
  const role = String(me?.orgRole || me?.role || "viewer");
  const schoolName = String(me?.orgName || me?.org?.name || "Your School");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-1">
          <div className="text-xs font-semibold tracking-widest text-orange-400">STREAMLINE EDU</div>
          <div className="text-2xl font-bold text-white">Dashboard</div>
          <div className="text-sm text-slate-400">
            {schoolName} • {role}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
            <div className="text-sm text-slate-400">Broadcast Status</div>
            <div className="mt-2 text-2xl font-bold text-slate-500">OFF AIR</div>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
            <div className="text-sm text-slate-400">Next Scheduled</div>
            <div className="mt-2 text-lg font-semibold text-white">—</div>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
            <div className="text-sm text-slate-400">Recordings</div>
            <div className="mt-2 text-lg font-semibold text-white">—</div>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
            <div className="text-sm text-slate-400">Active Students</div>
            <div className="mt-2 text-lg font-semibold text-white">—</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <button className="rounded-2xl bg-orange-500 px-6 py-5 text-left font-semibold text-white hover:bg-orange-400">
            Start Broadcast
            <div className="mt-1 text-sm font-normal text-orange-100/80">Go live to your school network</div>
          </button>
          <button className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-5 text-left font-semibold text-white hover:bg-slate-900/60">
            Schedule Event
            <div className="mt-1 text-sm font-normal text-slate-400">Plan upcoming broadcasts</div>
          </button>
          <button className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-5 text-left font-semibold text-white hover:bg-slate-900/60">
            Website Embed
            <div className="mt-1 text-sm font-normal text-slate-400">Get code for your site</div>
          </button>
        </div>

        {String(role) !== "faculty_admin" ? null : (
          <div className="mt-8 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
            <div className="text-sm font-semibold text-white">Faculty Admin</div>
            <div className="mt-1 text-sm text-slate-400">Settings will appear here for EDU org admins.</div>
          </div>
        )}
      </div>
    </div>
  );
}
