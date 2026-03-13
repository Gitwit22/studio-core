import { describe, it, expect } from "vitest";
import { studioMenu } from "@/config/studioMenu";

describe("studioMenu", () => {
  it("should have File, Edit, Insert, and Transport menus", () => {
    const titles = studioMenu.map((m) => m.title);
    expect(titles).toEqual(["File", "Edit", "Insert", "Transport"]);
  });

  it("should have items with label and action for every menu", () => {
    for (const menu of studioMenu) {
      expect(menu.items.length).toBeGreaterThan(0);
      for (const item of menu.items) {
        expect(item.label).toBeTruthy();
        expect(item.action).toBeTruthy();
      }
    }
  });

  it("File menu should contain expected items", () => {
    const file = studioMenu.find((m) => m.title === "File")!;
    const labels = file.items.map((i) => i.label);
    expect(labels).toContain("New Project");
    expect(labels).toContain("Save");
    expect(labels).toContain("Export");
  });

  it("Transport menu should contain Play, Stop, Record", () => {
    const transport = studioMenu.find((m) => m.title === "Transport")!;
    const labels = transport.items.map((i) => i.label);
    expect(labels).toEqual(["Play", "Stop", "Record"]);
  });
});
