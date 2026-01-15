export const CURRENT_TOS_VERSION = "2025-01-01";

export function hasAcceptedCurrentTos(user: any | null | undefined): boolean {
  if (!user) return false;
  if (typeof user.tosVersion !== "string" || typeof user.tosAcceptedAt !== "number") return false;
  return user.tosVersion === CURRENT_TOS_VERSION;
}
