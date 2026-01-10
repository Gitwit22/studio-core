import { useEffect, useState, useCallback } from "react";
import { API_BASE } from "../lib/apiBase";

export interface AuthUser {
  id?: string;
  uid?: string;
  email?: string;
  planId?: string;
  isAdmin?: boolean;
  billingEnabled?: boolean;
  platformBillingEnabled?: boolean;
  effectiveBillingEnabled?: boolean;
  billingMode?: "test" | "live" | string;
  // Allow arbitrary additional fields from the server without losing type-safety on the ones we care about.
  [key: string]: any;
}

let cachedUser: AuthUser | null | undefined = undefined; // undefined => not fetched yet
let inFlight: Promise<AuthUser | null> | null = null;

// Bootstrap cachedUser from localStorage if available so login works
// even if /api/auth/me is temporarily unreachable (e.g., dev env).
if (typeof window !== "undefined" && cachedUser === undefined) {
  try {
    const raw = window.localStorage.getItem("sl_user");
    if (raw && raw !== "undefined") {
      cachedUser = JSON.parse(raw);
    }
  } catch {
    cachedUser = null;
  }
}

async function loadAuthMe(): Promise<AuthUser | null> {
  if (cachedUser !== undefined) return cachedUser;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
      });

      if (res.status === 401) {
        cachedUser = null;
        return null;
      }

      if (!res.ok) {
        throw new Error(`auth/me failed: ${res.status}`);
      }

      const data = await res.json();
      cachedUser = data;
      return data;
    } catch (err) {
      cachedUser = null;
      throw err;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function isAuthUserInTestMode(user: AuthUser | null | undefined): boolean {
  if (!user) return false;

  // Canonical: effectiveBillingEnabled === false
  if (user.effectiveBillingEnabled === false) return true;

  // Legacy per-user test mode: explicit billingEnabled === false
  if (user.billingEnabled === false) return true;

  // Fallback: older payloads that only expose billingMode
  if (user.billingMode === "test") return true;

  return false;
}

export function useAuthMe() {
  const [user, setUser] = useState<AuthUser | null>(cachedUser ?? null);
  const [loading, setLoading] = useState<boolean>(cachedUser === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (cachedUser !== undefined) {
      setLoading(false);
      return;
    }

    loadAuthMe()
      .then((data) => {
        if (!isMounted) return;
        setUser(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setUser(null);
        setError(err?.message || String(err));
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    cachedUser = undefined;
    setLoading(true);
    setError(null);
    try {
      const data = await loadAuthMe();
      setUser(data);
      setLoading(false);
    } catch (err: any) {
      setUser(null);
      setError(err?.message || String(err));
      setLoading(false);
    }
  }, []);

  return { user, loading, error, refresh } as const;
}
