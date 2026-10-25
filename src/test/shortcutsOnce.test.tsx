import { describe, it, expect, vi, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"

const runCommand = vi.fn()
vi.mock("@/studio/commandBus", () => ({
  runCommand: (name: string) => runCommand(name),
  registerCommand: vi.fn(),
  hasCommand: vi.fn(),
}))
vi.mock("tone", () => ({}))

import MenuBar from "@/components/studio/MenuBar"
import { registerStudioShortcuts } from "@/studio/registerShortcuts"

describe("keyboard shortcuts with the menu bar mounted", () => {
  afterEach(() => { cleanup(); runCommand.mockClear() })

  it.each([
    [{ key: " ", code: "Space" }, "transport:play"],
    [{ key: "r", code: "KeyR" }, "transport:record"],
    [{ key: "s", code: "KeyS", ctrlKey: true }, "project:save"],
    [{ key: "z", code: "KeyZ", ctrlKey: true }, "edit:undo"],
  ])("%o runs %s exactly once", (init, command) => {
    render(<MenuBar />)
    const unregister = registerStudioShortcuts()
    document.body.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true }))
    unregister()
    expect(runCommand.mock.calls.filter(([name]) => name === command)).toHaveLength(1)
  })
})
