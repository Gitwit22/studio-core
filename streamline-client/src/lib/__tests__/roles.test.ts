import { describe, expect, it } from "vitest";
import {
  extractPresenceMetadata,
  isParticipantHidden,
  isNonNormalPresence,
  presenceModeLabel,
} from "../roles";

describe("extractPresenceMetadata", () => {
  it("parses JSON string metadata", () => {
    const p = { metadata: JSON.stringify({ presenceMode: "invisible", isVisibleInRoster: false }) };
    const meta = extractPresenceMetadata(p);
    expect(meta).not.toBeNull();
    expect(meta?.presenceMode).toBe("invisible");
    expect(meta?.isVisibleInRoster).toBe(false);
  });

  it("handles object metadata", () => {
    const p = { metadata: { presenceMode: "silent", isVisibleInRoster: true } as any };
    const meta = extractPresenceMetadata(p);
    expect(meta?.presenceMode).toBe("silent");
  });

  it("returns null for missing metadata", () => {
    expect(extractPresenceMetadata(null)).toBeNull();
    expect(extractPresenceMetadata({})).toBeNull();
    expect(extractPresenceMetadata({ metadata: "" })).toBeNull();
  });
});

describe("isParticipantHidden", () => {
  it("hides invisible participants", () => {
    const p = { metadata: JSON.stringify({ presenceMode: "invisible", isVisibleInRoster: false }) };
    expect(isParticipantHidden(p)).toBe(true);
  });

  it("shows normal participants", () => {
    const p = { metadata: JSON.stringify({ presenceMode: "normal", isVisibleInRoster: true }) };
    expect(isParticipantHidden(p)).toBe(false);
  });

  it("shows silent participants (visible in roster)", () => {
    const p = { metadata: JSON.stringify({ presenceMode: "silent", isVisibleInRoster: true }) };
    expect(isParticipantHidden(p)).toBe(false);
  });

  it("returns false for no metadata", () => {
    expect(isParticipantHidden({})).toBe(false);
    expect(isParticipantHidden(null)).toBe(false);
  });
});

describe("isNonNormalPresence", () => {
  it("detects silent mode", () => {
    const p = { metadata: JSON.stringify({ presenceMode: "silent" }) };
    expect(isNonNormalPresence(p)).toBe(true);
  });

  it("detects invisible mode", () => {
    const p = { metadata: JSON.stringify({ presenceMode: "invisible" }) };
    expect(isNonNormalPresence(p)).toBe(true);
  });

  it("returns false for normal mode", () => {
    const p = { metadata: JSON.stringify({ presenceMode: "normal" }) };
    expect(isNonNormalPresence(p)).toBe(false);
  });
});

describe("presenceModeLabel", () => {
  it("returns human-readable labels", () => {
    expect(presenceModeLabel("normal")).toBe("Normal");
    expect(presenceModeLabel("silent")).toBe("Silent Moderator");
    expect(presenceModeLabel("invisible")).toBe("Invisible Moderator");
  });
});
