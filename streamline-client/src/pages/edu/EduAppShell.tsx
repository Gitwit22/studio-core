import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { getAuthToken } from "../../lib/api";
import { getMeCached } from "../../lib/meCache";
import EduDashboard from "./EduDashboard";

type MePayload = {
  id?: string;
  orgId?: string | null;
  orgType?: string | null;
  orgRole?: string | null;
  orgName?: string | null;
  [k: string]: any;
};

export default function EduAppShell() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bypassEnabled = useMemo(() => {
    if (!import.meta.env.DEV) return false;
    try {
      return localStorage.getItem("sl_edu_bypass") === "1";
    } catch {
      return false;
    }
  }, [location.key]);

  const authed = useMemo(() => {
    if (bypassEnabled) return true;
    try {
      return !!getAuthToken();
    } catch {
      return false;
    }
  }, [bypassEnabled]);

  useEffect(() => {
    let mounted = true;

    // Keep lane intent sticky.
    try {
      localStorage.setItem("sl_entry_lane", "edu");
      localStorage.setItem("sl_mode", "edu");
    } catch {}

    if (!authed) {
      setLoading(false);
      setMe(null);
      return;
    }

    if (bypassEnabled) {
      setError(null);
      setMe({
        orgType: "edu",
        orgRole: "faculty_admin",
        orgName: "EDU Demo",
        id: "edu-demo",
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    getMeCached()
      .then((data) => {
        if (!mounted) return;
        setMe((data as any) || null);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setMe(null);
        setError(err?.message || String(err));
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [authed, bypassEnabled]);

  if (!authed) {
    const sp = new URLSearchParams();
    sp.set("returnTo", `${location.pathname}${location.search}`);
    return <Navigate to={`/streamline/edu/login?${sp.toString()}`} replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-slate-400">Loading EDU…</div>
      </div>
    );
  }

  // Guard: authenticated but not EDU
  if (me && me.orgType && me.orgType !== "edu") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
            <div className="text-lg font-semibold text-white">Access restricted</div>
            <div className="mt-2 text-sm text-slate-400">
              Your account isn’t configured for StreamLine EDU.
            </div>
            <div className="mt-4">
              <a
                href="/join"
                className="inline-flex rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Go to StreamLine
              </a>
            </div>
          </div>
          {error && <div className="mt-4 text-xs text-slate-600">{error}</div>}
        </div>
      </div>
    );
  }

  // If orgType is missing, treat as non-EDU until schema is wired.
  if (me && me.orgType == null) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
            <div className="text-lg font-semibold text-white">EDU setup required</div>
            <div className="mt-2 text-sm text-slate-400">
              Your account is signed in, but EDU org details aren’t available yet.
            </div>
            <div className="mt-4">
              <a
                href="/join"
                className="inline-flex rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Go to StreamLine
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isFacultyAdmin = String(me?.orgRole || "") === "faculty_admin";

  return (
    <Routes>
      <Route path="/" element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<EduDashboard me={me} page="dashboard" />} />
      <Route path="broadcast" element={<EduDashboard me={me} page="broadcast" />} />
      <Route path="events" element={<EduDashboard me={me} page="events" />} />
      <Route path="archive" element={<EduDashboard me={me} page="archive" />} />
      <Route path="people" element={<EduDashboard me={me} page="people" />} />
      <Route path="embed" element={<EduDashboard me={me} page="embed" />} />
      <Route
        path="settings"
        element={isFacultyAdmin ? <EduDashboard me={me} page="settings" /> : <Navigate to="/streamline/edu/dashboard" replace />}
      />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}
