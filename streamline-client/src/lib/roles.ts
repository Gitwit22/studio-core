export type UiRolePresetId = "participant" | "cohost";

export function normalizeUiRolePresetId(raw: any): UiRolePresetId {
  return raw === "cohost" ? "cohost" : "participant";
}

// ---------------------------------------------------------------------------
// Presence Mode helpers (mirrors server-side lib/presenceMode.ts)
// ---------------------------------------------------------------------------

/** How a participant appears in the room. */
export type PresenceMode = "normal" | "silent" | "invisible";

/** Parsed metadata shape attached to LiveKit participants by the server. */
export interface PresenceMetadata {
  role?: string;
  presenceMode?: PresenceMode;
  isVisibleInRoster?: boolean;
  canSendChat?: boolean;
  canReadChat?: boolean;
  rolePresetId?: string;
}

/**
 * Extract presence metadata from a LiveKit participant object.
 * Handles both pre-parsed objects and JSON strings.
 */
export function extractPresenceMetadata(
  rawParticipant: { metadata?: string | Record<string, unknown> } | null | undefined,
): PresenceMetadata | null {
  if (!rawParticipant) return null;
  const meta = rawParticipant.metadata;
  if (!meta) return null;

  if (typeof meta === "object") return meta as unknown as PresenceMetadata;
  if (typeof meta === "string" && meta.trim()) {
    try {
      return JSON.parse(meta) as PresenceMetadata;
    } catch {
      return null;
    }
  }
  return null;
}

/** Returns true when the participant should be hidden from the normal roster. */
export function isParticipantHidden(
  rawParticipant: { metadata?: string | Record<string, unknown> } | null | undefined,
): boolean {
  const meta = extractPresenceMetadata(rawParticipant);
  if (!meta) return false;
  if (meta.isVisibleInRoster === false) return true;
  if (meta.presenceMode === "invisible") return true;
  return false;
}

/** Returns true when the participant is in a non-normal presence mode. */
export function isNonNormalPresence(
  rawParticipant: { metadata?: string | Record<string, unknown> } | null | undefined,
): boolean {
  const meta = extractPresenceMetadata(rawParticipant);
  if (!meta) return false;
  return meta.presenceMode === "silent" || meta.presenceMode === "invisible";
}

/** User-friendly label for a presence mode. */
export function presenceModeLabel(mode: PresenceMode): string {
  switch (mode) {
    case "silent":
      return "Silent Moderator";
    case "invisible":
      return "Invisible Moderator";
    default:
      return "Normal";
  }
}
