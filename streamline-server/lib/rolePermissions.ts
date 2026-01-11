import { getEffectiveEntitlements } from "./effectiveEntitlements";

export type RoomRole = "participant" | "moderator" | "cohost";

export type RolePermissions = {
  canStream: boolean;
  canRecord: boolean;
  canDestinations: boolean;
  canModerate: boolean;
  canLayout: boolean;
  canScreenShare: boolean;
  canInvite: boolean;
  canAnalytics: boolean;
};

// Simple-mode role matrix used for invite-based roles and default profiles.
// These values are aligned with SIMPLE_ROLE_DEFAULTS in routes/account.ts.
export const ROLE_PERMISSIONS: Record<RoomRole, RolePermissions> = {
  participant: {
    canStream: false,
    canRecord: false,
    canDestinations: false,
    canModerate: false,
    canLayout: false,
    canScreenShare: false,
    canInvite: false,
    canAnalytics: false,
  },
  moderator: {
    canStream: false,
    canRecord: false,
    canDestinations: false,
    canModerate: true,
    canLayout: true,
    canScreenShare: false,
    canInvite: false,
    canAnalytics: false,
  },
  cohost: {
    canStream: true,
    canRecord: true,
    canDestinations: true,
    canModerate: false,
    canLayout: true,
    canScreenShare: true,
    canInvite: true,
    canAnalytics: false,
  },
};

/**
 * Intersect a role's permission flags with the entitlements of the "owner" account
 * (typically the host who created the room or invite).
 *
 * - Recording is only enabled when the host plan has recording feature.
 * - External destinations / multistream are only enabled when the host plan
 *   has RTMP/multistream enabled.
 */
export async function intersectPermissionsWithEntitlements(
  perms: Record<string, boolean>,
  uid?: string
): Promise<Record<string, boolean>> {
  if (!uid) return perms;
  try {
    const ent = await getEffectiveEntitlements(uid);
    const planFeatures = ent.features;
    const rawFeatures = (ent.plan.raw?.features || {}) as any;

    const next: Record<string, boolean> = { ...perms };

    if (Object.prototype.hasOwnProperty.call(next, "canRecord")) {
      next.canRecord = !!next.canRecord && !!planFeatures.recording;
    }

    if (Object.prototype.hasOwnProperty.call(next, "canDestinations")) {
      const rtmpEnabled = Boolean(
        planFeatures.multistream ||
        planFeatures.rtmp ||
        rawFeatures.rtmpMultistream ||
        rawFeatures.multistream ||
        (ent.plan.raw as any)?.multistreamEnabled
      );
      next.canDestinations = !!next.canDestinations && rtmpEnabled;
    }

    return next;
  } catch (err) {
    console.error("[rolePermissions] failed to intersect permissions with entitlements", err);
    return perms;
  }
}
