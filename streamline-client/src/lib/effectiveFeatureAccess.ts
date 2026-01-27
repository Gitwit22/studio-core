import { isFeatureAvailable, isPlatformEnabled } from "./featureAvailability";

export type EffectiveEntitlementsLike = {
  features?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  planId?: string;
  planName?: string;
};

export type PlatformFlagsLike = {
  hlsEnabled?: unknown;
  hlsSettingsTab?: unknown;
  transcodeEnabled?: unknown;
  recordingEnabled?: unknown;

  // Segmented, safety-first platform switches:
  // - Missing/undefined => disabled (must be explicitly enabled)
  contentLibraryEnabled?: unknown;
  libraryEnabled?: unknown;
  projectsEnabled?: unknown;
  editorEnabled?: unknown;
};

function isNewPlatformFlagEnabled(value: unknown): boolean {
  // Safety-first: new segmented flags default to disabled when missing.
  return value === true;
}

function resolveEntitlementBoolean(features: Record<string, unknown> | null | undefined, keys: string[]): boolean {
  const f: any = features || {};
  for (const key of keys) {
    if (typeof f[key] === "boolean") return f[key];
  }
  // Safety-first: new entitlements default to disabled when missing.
  return false;
}

function resolveEditingAccess(features: Record<string, unknown> | null | undefined): boolean {
  const f: any = features || {};
  // Default: enabled unless explicitly disabled by plan.
  // (Server does not currently send a dedicated editing entitlement, but this
  // keeps the door open for future plan-based gating.)
  const explicit = f.editing ?? f.editingEnabled ?? f.postProduction;
  if (typeof explicit === "boolean") return explicit;
  return true;
}

function resolveRtmpDestinationsMax(effectiveEntitlements: EffectiveEntitlementsLike | null | undefined): number {
  const limits = (effectiveEntitlements && effectiveEntitlements.limits) || {};
  const raw = (limits as any).rtmpDestinationsMax ?? (limits as any).maxDestinations ?? 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function resolveCanHlsRuntime(features: Record<string, unknown> | null | undefined): boolean {
  const f: any = features || {};
  const runtime = f.hls ?? f.hlsEnabled;
  const legacy = f.canHls;
  if (typeof runtime === "boolean") return runtime;
  if (typeof legacy === "boolean") return legacy;
  return false;
}

function resolveCanHlsSetup(features: Record<string, unknown> | null | undefined): boolean {
  const f: any = features || {};
  const explicit = f.hlsCustomizationEnabled;
  if (typeof explicit === "boolean") return explicit;
  const legacy = f.canCustomizeHlsPage;
  if (typeof legacy === "boolean") return legacy;
  // Back-compat: if a plan has HLS but no explicit setup flag, treat setup as included.
  return resolveCanHlsRuntime(f);
}

export function computeEffectiveFeatureAccess(input: {
  effectiveEntitlements?: EffectiveEntitlementsLike | null;
  platformFlags?: PlatformFlagsLike | null;
}): {
  platform: {
    hlsEnabled: boolean;
    transcodeEnabled: boolean;
    recordingEnabled: boolean;
  };
  plan: {
    rtmpDestinationsMax: number;
    hlsRuntime: boolean;
    hlsSetup: boolean;
    destinations: boolean;
    multistream: boolean;
    editing: boolean;
  };
  canUse: {
    hlsRuntime: boolean;
    hlsSetup: boolean;
    destinations: boolean;
    multistream: boolean;
  };
  editing: {
    allowed: boolean;
  };
  contentLibrary: {
    allowed: boolean;
  };
  projects: {
    allowed: boolean;
  };
  editor: {
    allowed: boolean;
  };
} {
  const eff = input.effectiveEntitlements || {};
  const pf = (input.platformFlags && typeof input.platformFlags === "object") ? input.platformFlags : {};

  // Prefer explicit platform kill-switches; default to enabled when missing.
  const platformHlsEnabled = isPlatformEnabled((pf as any).hlsEnabled ?? (pf as any).hlsSettingsTab);
  const platformTranscodeEnabled = isPlatformEnabled((pf as any).transcodeEnabled);
  const platformRecordingEnabled = isPlatformEnabled((pf as any).recordingEnabled);

  // New segmented flags: missing => disabled.
  const platformContentLibraryEnabled = isNewPlatformFlagEnabled(
    (pf as any).contentLibraryEnabled ?? (pf as any).libraryEnabled
  );
  const platformProjectsEnabled = isNewPlatformFlagEnabled((pf as any).projectsEnabled);
  const platformEditorEnabled = isNewPlatformFlagEnabled((pf as any).editorEnabled);

  const features = (eff as any).features || {};
  const rtmpDestinationsMax = resolveRtmpDestinationsMax(eff as any);

  const planHlsRuntime = resolveCanHlsRuntime(features);
  const planHlsSetup = resolveCanHlsSetup(features);

  const planEditing = resolveEditingAccess(features);

  const planContentLibrary = resolveEntitlementBoolean(features, ["contentLibrary", "library"]);
  const planProjects = resolveEntitlementBoolean(features, ["projects"]);
  const planEditor = resolveEntitlementBoolean(features, ["editor"]);

  // Numeric RTMP destinations cap is canonical for availability.
  const planDestinations = rtmpDestinationsMax >= 1;
  const planMultistream = rtmpDestinationsMax >= 2;

  return {
    platform: {
      hlsEnabled: platformHlsEnabled,
      transcodeEnabled: platformTranscodeEnabled,
      recordingEnabled: platformRecordingEnabled,
    },
    plan: {
      rtmpDestinationsMax,
      hlsRuntime: planHlsRuntime,
      hlsSetup: planHlsSetup,
      destinations: planDestinations,
      multistream: planMultistream,
      editing: planEditing,
    },
    canUse: {
      hlsRuntime: isFeatureAvailable(planHlsRuntime, platformHlsEnabled),
      hlsSetup: isFeatureAvailable(planHlsSetup, platformHlsEnabled),
      destinations: isFeatureAvailable(planDestinations, platformTranscodeEnabled),
      multistream: isFeatureAvailable(planMultistream, platformTranscodeEnabled),
    },
    editing: {
      // Legacy: keep for backwards compatibility (now mapped to editor rules)
      allowed: isFeatureAvailable(planEditor || planEditing, platformEditorEnabled && platformTranscodeEnabled),
    },
    contentLibrary: {
      allowed: isFeatureAvailable(planContentLibrary, platformContentLibraryEnabled),
    },
    projects: {
      // Derived: editor implies projects, but projects do not imply editor.
      allowed:
        isFeatureAvailable(planProjects, platformProjectsEnabled) ||
        isFeatureAvailable(planEditor, platformEditorEnabled && platformTranscodeEnabled),
    },
    editor: {
      allowed: isFeatureAvailable(planEditor, platformEditorEnabled && platformTranscodeEnabled),
    },
  };
}
