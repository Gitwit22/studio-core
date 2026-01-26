import { useEffect, useState } from "react";
import { getPlatformFlagsCached, type PlatformFlags } from "../lib/platformFlagsCache";

export function usePlatformFlags() {
  const [flags, setFlags] = useState<PlatformFlags | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlatformFlagsCached()
      .then((f) => {
        if (!cancelled) setFlags(f || {});
      })
      .catch(() => {
        if (!cancelled) setFlags({ transcodeEnabled: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    flags,
    loading: flags === null,
  } as const;
}
