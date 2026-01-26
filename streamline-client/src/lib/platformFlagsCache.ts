import { apiFetch } from "./api";

export type PlatformFlags = {
  hlsEnabled?: boolean;
  hlsSettingsTab?: boolean;
  recordingEnabled?: boolean;
  transcodeEnabled?: boolean;
  [key: string]: any;
};

let cachedFlags: PlatformFlags | null | undefined = undefined; // undefined => not fetched yet
let inFlight: Promise<PlatformFlags> | null = null;

export function clearPlatformFlagsCache() {
  cachedFlags = undefined;
  inFlight = null;
}

export function getCachedPlatformFlagsValue(): PlatformFlags | null | undefined {
  return cachedFlags;
}

export async function getPlatformFlagsCached(): Promise<PlatformFlags> {
  if (cachedFlags !== undefined) return cachedFlags || {};

  if (!inFlight) {
    inFlight = (async () => {
      try {
        const res = await apiFetch("/api/plans", {}, { allowNonOk: true });
        if (!res.ok) {
          cachedFlags = { transcodeEnabled: false };
          return cachedFlags;
        }
        const json = await res.json().catch(() => null);
        const flags = ((json as any)?.platformFlags || {}) as PlatformFlags;
        cachedFlags = flags && typeof flags === "object" ? flags : { transcodeEnabled: false };
        return cachedFlags;
      } catch {
        cachedFlags = { transcodeEnabled: false };
        return cachedFlags;
      } finally {
        inFlight = null;
      }
    })();
  }

  return inFlight;
}
