import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function EduLanding() {
  useEffect(() => {
    try {
      localStorage.setItem("sl_entry_lane", "edu");
    } catch {}
    try {
      document.cookie = `edu_mode=1; path=/; max-age=${60 * 60 * 24 * 365}`;
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10">
          <div className="text-sm font-semibold tracking-widest text-orange-400">STREAMLINE EDU</div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
            Student broadcasting and school communications — simplified.
          </h1>
          <p className="mt-4 text-lg text-slate-400">
            Run announcements, events, and assemblies with a role-governed, school-safe workflow.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
            <div className="text-sm font-semibold text-white">HLS on your website</div>
            <div className="mt-1 text-sm text-slate-400">Embed a school-safe stream in minutes.</div>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
            <div className="text-sm font-semibold text-white">Role-governed access</div>
            <div className="mt-1 text-sm text-slate-400">Faculty, student producers, talent, and viewers.</div>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
            <div className="text-sm font-semibold text-white">Recording archive</div>
            <div className="mt-1 text-sm text-slate-400">Keep a searchable library for your school.</div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to="/streamline/edu/login"
            className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-400"
          >
            Faculty / Student Sign In
          </Link>
          <a
            href="mailto:support@nxtlvltechsolutions.com?subject=StreamLine%20EDU%20Pilot"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/30 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900/50"
          >
            Request a Pilot
          </a>
        </div>

        <div className="mt-10 text-xs text-slate-500">
          Powered by Nxt Lvl Technology Solutions
        </div>
      </div>
    </div>
  );
}
