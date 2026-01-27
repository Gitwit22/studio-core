import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetchAuth } from "../lib/api";

export default function BillingCanceled() {
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiFetchAuth("/api/billing/clear-pending", { method: "POST" }, { allowNonOk: true });
      } catch {}
      if (!cancelled) nav("/settings/billing", { replace: true });
    })();
    return () => { cancelled = true; };
  }, [nav]);

  return null;
}
