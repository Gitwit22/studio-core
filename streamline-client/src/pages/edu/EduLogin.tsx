import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetchAuth, clearAuthStorage } from "../../lib/api";

function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export default function EduLogin() {
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

  const returnTo = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search || "");
      const rt = sp.get("returnTo") || "";
      if (!rt) return null;
      if (!rt.startsWith("/")) return null;
      if (rt.startsWith("//")) return null;
      return rt;
    } catch {
      return null;
    }
  }, [location.search]);

  useEffect(() => {
    try {
      localStorage.setItem("sl_entry_lane", "edu");
      localStorage.setItem("sl_mode", "edu");
    } catch {}
    try {
      document.cookie = `edu_mode=1; path=/; max-age=${60 * 60 * 24 * 365}`;
    } catch {}
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          clearAuthStorage();
        }
        const ct = res.headers.get("content-type") || "";
        const errBody = ct.includes("application/json") ? await res.json().catch(() => ({})) : {};
        setError((errBody as any)?.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      let loginBody: any = null;
      try {
        const ctLogin = res.headers.get("content-type") || "";
        loginBody = ctLogin.includes("application/json") ? await res.json() : null;
      } catch {
        loginBody = null;
      }

      const token = (loginBody as any)?.token as string | undefined;
      if (!token) {
        clearAuthStorage();
        setError("Login failed: missing token from server");
        setLoading(false);
        return;
      }

      try {
        localStorage.setItem("authToken", token);
      } catch {}

      // Hydrate canonical /api/account/me; this is also what EDU guard uses.
      let me: any = null;
      try {
        const meRes = await apiFetchAuth("/api/account/me", { cache: "no-store" });
        me = await meRes.json();
        try {
          localStorage.setItem("sl_user", JSON.stringify(me));
        } catch {}
      } catch (err) {
        console.warn("[EduLogin] /account/me after login failed", err);
      }

      setLoading(false);

      // EDU router rules
      const lane = (() => {
        try {
          return localStorage.getItem("sl_entry_lane");
        } catch {
          return null;
        }
      })();

      if (me?.orgType === "edu" || lane === "edu") {
        nav(returnTo || "/streamline/edu/dashboard", { replace: true });
        return;
      }

      // Fallback to the regular app if they aren't EDU.
      nav("/join", { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* Left panel */}
        <div className="hidden flex-col justify-between border-r border-slate-800/60 bg-slate-950 p-10 lg:flex">
          <div>
            <div className="text-sm font-semibold tracking-widest text-orange-400">STREAMLINE EDU</div>
            <div className="mt-4 text-3xl font-bold text-white">School-safe broadcasting</div>
            <ul className="mt-6 space-y-2 text-sm text-slate-400">
              <li>• HLS embed for school websites</li>
              <li>• Role-based access (Faculty / Students)</li>
              <li>• Automatic recording archive</li>
            </ul>
          </div>
          <div className="text-xs text-slate-500">Powered by Nxt Lvl Technology Solutions</div>
        </div>

        {/* Right panel */}
        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-800/60 bg-slate-900/40 p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Sign in</h1>
              <div className="mt-1 text-sm text-slate-400">Faculty / Student access</div>
            </div>

            {/* Google sign-in can be added here if/when the backend supports it. */}

            {error && (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="mt-1 w-full rounded-2xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none focus:border-orange-500/60"
                  placeholder="name@school.edu"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  className="mt-1 w-full rounded-2xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none focus:border-orange-500/60"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <div className="mt-6 text-xs text-slate-500">
              Tip: If you don’t have a school EDU role yet, ask your Faculty Admin.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
