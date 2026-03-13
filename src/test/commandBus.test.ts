import { describe, it, expect, beforeEach } from "vitest"
import { registerCommand, runCommand, hasCommand } from "@/studio/commandBus"

describe("commandBus", () => {
  it("registers and runs a command", () => {
    let called = false
    registerCommand("test:command", () => {
      called = true
    })
    runCommand("test:command")
    expect(called).toBe(true)
  })

  it("hasCommand returns true for registered commands", () => {
    registerCommand("test:exists", () => {})
    expect(hasCommand("test:exists")).toBe(true)
  })

  it("hasCommand returns false for unregistered commands", () => {
    expect(hasCommand("test:nonexistent")).toBe(false)
  })

  it("runCommand does not throw for unregistered commands", () => {
    expect(() => runCommand("test:missing")).not.toThrow()
  })

  it("can overwrite a command", () => {
    let value = 0
    registerCommand("test:overwrite", () => { value = 1 })
    registerCommand("test:overwrite", () => { value = 2 })
    runCommand("test:overwrite")
    expect(value).toBe(2)
  })
})
