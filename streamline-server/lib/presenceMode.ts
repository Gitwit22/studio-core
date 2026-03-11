/**
 * Presence mode controls how a participant appears and behaves in a room.
 *
 * - "normal"    – Visible in roster, standard permissions.
 * - "silent"    – Visible in roster to admins, no mic/video/chat.
 * - "invisible" – Hidden from standard roster and interaction surfaces.
 */
export type PresenceMode = "normal" | "silent" | "invisible";

/** Roles that can meaningfully use non-normal presence modes. */
export type PresenceCapableRole = "host" | "cohost" | "mod" | "bot";

/** Extended room role that includes moderator and bot roles. */
export type ExtendedRoomRole =
  | "host"
  | "cohost"
  | "speaker"
  | "participant"
  | "mod"
  | "bot";

/** Metadata shape embedded in the LiveKit participant token. */
export interface PresenceMetadata {
  role?: string;
  presenceMode?: PresenceMode;
  isVisibleInRoster?: boolean;
  canSendChat?: boolean;
  canReadChat?: boolean;
  rolePresetId?: string;
}

/** Default capability flags derived from a given presence mode. */
export interface PresenceModeDefaults {
  canPublishAudio: boolean;
  canPublishVideo: boolean;
  canSendChat: boolean;
  canReadChat: boolean;
  isVisibleInRoster: boolean;
  canModerate: boolean;
}

const PRESENCE_MODE_DEFAULTS: Record<PresenceMode, PresenceModeDefaults> = {
  normal: {
    canPublishAudio: true,
    canPublishVideo: true,
    canSendChat: true,
    canReadChat: true,
    isVisibleInRoster: true,
    canModerate: false,
  },
  silent: {
    canPublishAudio: false,
    canPublishVideo: false,
    canSendChat: false,
    canReadChat: true,
    isVisibleInRoster: true,
    canModerate: true,
  },
  invisible: {
    canPublishAudio: false,
    canPublishVideo: false,
    canSendChat: false,
    canReadChat: true,
    isVisibleInRoster: false,
    canModerate: true,
  },
};

/** Returns true when the value is a valid PresenceMode literal. */
export function isValidPresenceMode(v: unknown): v is PresenceMode {
  return v === "normal" || v === "silent" || v === "invisible";
}

/** Look up the default capability flags for a presence mode. */
export function getPresenceModeDefaults(mode: PresenceMode): PresenceModeDefaults {
  return PRESENCE_MODE_DEFAULTS[mode];
}

/**
 * Build LiveKit participant metadata that the frontend uses to
 * decide visibility and capabilities for a given participant.
 */
export function buildPresenceMetadata(opts: {
  role: string;
  presenceMode: PresenceMode;
  rolePresetId?: string;
}): PresenceMetadata {
  const defaults = getPresenceModeDefaults(opts.presenceMode);
  return {
    role: opts.role,
    presenceMode: opts.presenceMode,
    isVisibleInRoster: defaults.isVisibleInRoster,
    canSendChat: defaults.canSendChat,
    canReadChat: defaults.canReadChat,
    ...(opts.rolePresetId ? { rolePresetId: opts.rolePresetId } : {}),
  };
}
