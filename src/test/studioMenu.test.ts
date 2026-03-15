import { describe, it, expect } from "vitest";
import { studioMenu } from "@/config/studioMenu";

describe("studioMenu", () => {
  it("should have File, Edit, Track, View, Settings, and Help menus", () => {
    const titles = studioMenu.map((m) => m.title);
    expect(titles).toEqual(["File", "Edit", "Track", "View", "Settings", "Help"]);
  });

  it("should have items with label and action for every non-separator menu item", () => {
    for (const menu of studioMenu) {
      expect(menu.items.length).toBeGreaterThan(0);
      for (const item of menu.items) {
        if (!item.separator) {
          expect(item.label).toBeTruthy();
          expect(item.action).toBeTruthy();
        }
      }
    }
  });

  it("File menu should contain expected items", () => {
    const file = studioMenu.find((m) => m.title === "File")!;
    const labels = file.items.filter((i) => !i.separator).map((i) => i.label);
    expect(labels).toContain("New Session");
    expect(labels).toContain("Save Session");
    expect(labels).toContain("Export Mix");
    expect(labels).toContain("Close Session");
  });

  it("Help menu should contain About StreamLine Music Studio", () => {
    const help = studioMenu.find((m) => m.title === "Help")!;
    const labels = help.items.filter((i) => !i.separator).map((i) => i.label);
    expect(labels).toContain("About StreamLine Music Studio");
    expect(labels).toContain("Quick Start");
    expect(labels).toContain("Keyboard Shortcuts");
  });

  it("Settings menu should have Open Settings action", () => {
    const settings = studioMenu.find((m) => m.title === "Settings")!;
    expect(settings.items[0].action).toBe("modal:settings");
  });

  it("Track menu should contain expected items", () => {
    const track = studioMenu.find((m) => m.title === "Track")!;
    const labels = track.items.filter((i) => !i.separator).map((i) => i.label);
    expect(labels).toContain("Add Audio Track");
    expect(labels).toContain("Add Vocal Track");
    expect(labels).toContain("Mute Track");
    expect(labels).toContain("Solo Track");
  });

  it("View menu should use Snap to Grid and Free Move labels", () => {
    const view = studioMenu.find((m) => m.title === "View")!;
    const labels = view.items.filter((i) => !i.separator).map((i) => i.label);
    expect(labels).toContain("Snap to Grid");
    expect(labels).toContain("Free Move");
  });

  it("separator items should have separator flag", () => {
    const file = studioMenu.find((m) => m.title === "File")!;
    const separators = file.items.filter((i) => i.separator);
    expect(separators.length).toBeGreaterThan(0);
    for (const sep of separators) {
      expect(sep.separator).toBe(true);
    }
  });
});
