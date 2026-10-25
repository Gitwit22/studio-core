import { describe, it, expect, beforeEach, vi } from "vitest"
import { useStudioStore } from "@/studio/engine/studioStore"
import { useStudioSettings, defaultStudioSettings, snapBeat, autosaveIntervalMs } from "@/studio/settings/studioSettings"
import { runCommand } from "@/studio/commandBus"
import { studioMenu } from "@/config/studioMenu"
import "@/studio/commands/editCommands"

vi.mock("tone", () => ({}))

function addClip(extra: Record<string, unknown> = {}) {
  const s = useStudioStore.getState()
  s.addClip({ trackId: s.tracks[0].id, sourceId: "src", start: 2, end: 6, offset: 1, name: "c", gain: 1.5, ...extra })
  const clip = useStudioStore.getState().clips.at(-1)!
  useStudioStore.getState().setSelectedClipId(clip.id)
  return clip
}

describe("Edit menu commands", () => {
  beforeEach(() => {
    useStudioSettings.setState(defaultStudioSettings)
    useStudioStore.getState().newSession()
  })

  it("Duplicate Clip places a full copy right after the original and selects it", () => {
    const original = addClip()
    runCommand("edit:duplicateClip")
    const { clips, selectedClipId, undoStack, isDirty } = useStudioStore.getState()
    const copy = clips.find((c) => c.id === selectedClipId)!
    expect(clips).toHaveLength(2)
    expect(copy.id).not.toBe(original.id)
    expect(copy).toMatchObject({ start: 6, end: 10, offset: 1, gain: 1.5, trackId: original.trackId })
    expect(undoStack.length).toBeGreaterThan(0)
    expect(isDirty).toBe(true)
  })

  it("Delete removes the selected clip and can be undone", () => {
    addClip()
    runCommand("edit:delete")
    expect(useStudioStore.getState().clips).toHaveLength(0)
    useStudioStore.getState().undo()
    expect(useStudioStore.getState().clips).toHaveLength(1)
  })

  it("Delete leaves locked clips alone", () => {
    addClip({ locked: true })
    runCommand("edit:delete")
    expect(useStudioStore.getState().clips).toHaveLength(1)
  })

  it("menu: Select All is disabled (no multi-select yet) and Recent Sessions is enabled", () => {
    const items = studioMenu.flatMap((m) => m.items)
    expect(items.find((i) => i.action === "edit:selectAll")?.disabled).toBe(true)
    expect(items.find((i) => i.action === "session:recent")?.disabled).toBeFalsy()
  })
})

describe("studio settings", () => {
  beforeEach(() => useStudioSettings.setState(defaultStudioSettings))

  it("new sessions use the snap-by-default preference", () => {
    useStudioSettings.getState().updateSettings({ snapByDefault: false })
    useStudioStore.getState().newSession()
    expect(useStudioStore.getState().snapToGrid).toBe(false)
  })

  it("auto grid keeps the original steps; explicit divisions override them", () => {
    expect(snapBeat(2.6, 1, "auto")).toBe(3)
    expect(snapBeat(2.6, 0.25, "auto")).toBe(2.5)
    expect(snapBeat(2.6, 1, "1/8")).toBe(2.625)
    expect(snapBeat(5.9, 0.25, "bar")).toBe(4)
  })

  it("autosave interval Off disables the timer", () => {
    expect(autosaveIntervalMs("off")).toBeNull()
    expect(autosaveIntervalMs("1m")).toBe(60_000)
  })
})
