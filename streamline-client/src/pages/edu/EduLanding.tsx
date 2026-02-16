import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function EduLanding() {
  const nav = useNavigate();

  useEffect(() => {
    try {
      localStorage.setItem("sl_entry_lane", "edu");
      document.cookie = "edu_mode=1; path=/; SameSite=Lax";
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-10 flex items-start justify-between gap-6">
          <div>
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

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white">Broadcasting for schools.</h1>
            <p className="mt-3 max-w-2xl text-base text-slate-400">
              Secure streaming for announcements, events, and recordings — designed for school workflows.
            </p>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-slate-800/50 bg-slate-900/40 px-4 py-2 text-sm text-slate-400 md:flex">
            <span className="font-medium text-slate-200">EDU Lane</span>
            <span className="text-slate-600">•</span>
            <span>Login required</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6">
            <div className="text-sm font-semibold text-white">Announcements</div>
            <div className="mt-2 text-sm text-slate-400">Go live with daily broadcasts and time-sensitive messages.</div>
          </div>
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6">
            <div className="text-sm font-semibold text-white">Events</div>
            <div className="mt-2 text-sm text-slate-400">Stream concerts, sports, graduations, and assemblies.</div>
          </div>
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6">
            <div className="text-sm font-semibold text-white">Recordings</div>
            <div className="mt-2 text-sm text-slate-400">Archive broadcasts and share with your community.</div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            to="/streamline/edu/login"
            className="group rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-6 text-left transition-colors hover:from-orange-400 hover:to-amber-500"
          >
            <div className="mb-1 text-lg font-bold text-white">Continue to EDU Login</div>
            <div className="text-sm text-orange-100/80">Use your existing StreamLine account</div>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white">
              Enter →
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <a
            href="mailto:pilot@streamline.edu?subject=StreamLine%20EDU%20Pilot"
            className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 text-left transition-colors hover:bg-slate-800/50"
          >
            <div className="mb-1 text-lg font-bold text-white">Request a Pilot</div>
            <div className="text-sm text-slate-400">Get your school onboarded with EDU access</div>
            <div className="mt-4 text-sm font-semibold text-orange-400 hover:text-orange-300">Contact →</div>
          </a>
        </div>

        <div className="mt-10 text-xs text-slate-500">Not an EDU organization? Continue to the main platform.</div>

        {import.meta.env.DEV ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem("sl_edu_bypass", "1");
                } catch {}
                nav("/streamline/edu/dashboard");
              }}
              className="rounded-xl border border-slate-800/50 bg-slate-900/40 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800/50 hover:text-white"
            >
              DEV: Bypass login (demo)
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
