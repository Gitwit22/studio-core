import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidPresenceMode,
  getPresenceModeDefaults,
  buildPresenceMetadata,
} from "./presenceMode";

// ---------- isValidPresenceMode ----------

test("isValidPresenceMode accepts valid modes", () => {
  assert.ok(isValidPresenceMode("normal"));
  assert.ok(isValidPresenceMode("silent"));
  assert.ok(isValidPresenceMode("invisible"));
});

test("isValidPresenceMode rejects invalid values", () => {
  assert.equal(isValidPresenceMode(""), false);
  assert.equal(isValidPresenceMode("hidden"), false);
  assert.equal(isValidPresenceMode(null), false);
  assert.equal(isValidPresenceMode(undefined), false);
  assert.equal(isValidPresenceMode(42), false);
});

// ---------- getPresenceModeDefaults ----------

test("normal mode allows publish and is visible", () => {
  const d = getPresenceModeDefaults("normal");
  assert.equal(d.canPublishAudio, true);
  assert.equal(d.canPublishVideo, true);
  assert.equal(d.canSendChat, true);
  assert.equal(d.canReadChat, true);
  assert.equal(d.isVisibleInRoster, true);
  assert.equal(d.canModerate, false);
});

test("silent mode disables publish/chat but is visible", () => {
  const d = getPresenceModeDefaults("silent");
  assert.equal(d.canPublishAudio, false);
  assert.equal(d.canPublishVideo, false);
  assert.equal(d.canSendChat, false);
  assert.equal(d.canReadChat, true);
  assert.equal(d.isVisibleInRoster, true);
  assert.equal(d.canModerate, true);
});

test("invisible mode disables everything and hides from roster", () => {
  const d = getPresenceModeDefaults("invisible");
  assert.equal(d.canPublishAudio, false);
  assert.equal(d.canPublishVideo, false);
  assert.equal(d.canSendChat, false);
  assert.equal(d.canReadChat, true);
  assert.equal(d.isVisibleInRoster, false);
  assert.equal(d.canModerate, true);
});

// ---------- buildPresenceMetadata ----------

test("buildPresenceMetadata produces correct metadata for invisible mod", () => {
  const meta = buildPresenceMetadata({
    role: "mod",
    presenceMode: "invisible",
    rolePresetId: "cohost",
  });
  assert.equal(meta.role, "mod");
  assert.equal(meta.presenceMode, "invisible");
  assert.equal(meta.isVisibleInRoster, false);
  assert.equal(meta.canSendChat, false);
  assert.equal(meta.canReadChat, true);
  assert.equal(meta.rolePresetId, "cohost");
});

test("buildPresenceMetadata for normal mode", () => {
  const meta = buildPresenceMetadata({
    role: "host",
    presenceMode: "normal",
  });
  assert.equal(meta.role, "host");
  assert.equal(meta.presenceMode, "normal");
  assert.equal(meta.isVisibleInRoster, true);
  assert.equal(meta.canSendChat, true);
  assert.equal(meta.rolePresetId, undefined);
});
