import { useEffect, useState, useCallback } from "react";
import { API_BASE } from "../lib/apiBase";

export type AuthUser = any; // Server returns user doc shape; keep flexible for now

let cachedUser: AuthUser | null | undefined = undefined; // undefined => not fetched yet
let inFlight: Promise<AuthUser | null> | null = null;

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
