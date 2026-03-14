/**
 * Detect in-app browsers (Facebook, Instagram, TikTok, Twitter, LinkedIn)
 * that commonly block camera/mic access or have restricted WebRTC support.
 */
const IN_APP_PATTERN = /FBAN|FBAV|Instagram|TikTok|Twitter|LinkedInApp/i;

export function detectInAppBrowser(): boolean {
  return IN_APP_PATTERN.test(navigator.userAgent || "");
}

/**
 * Returns a human-readable name for the detected in-app browser,
 * or null if the browser is not an in-app browser.
 */
export function getInAppBrowserName(): string | null {
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV/i.test(ua)) return "Facebook";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/TikTok/i.test(ua)) return "TikTok";
  if (/Twitter/i.test(ua)) return "Twitter";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn";
  return null;
}
