import { describe, it, expect, beforeEach, vi } from "vitest"
import { useStudioStore } from "@/studio/engine/studioStore"
import {
  playTransport,
  stopTransport,
  recordTransport,
  stopRecording,
} from "@/studio/engine/transportEngine"

describe("transportEngine", () => {
  beforeEach(() => {
    stopTransport()
    useStudioStore.setState({
      isPlaying: false,
      isRecording: false,
      playhead: 0,
      bpm: 120,
      loop: { start: 0, end: 8, enabled: false },
    })
  })

  it("playTransport sets isPlaying to true", () => {
    playTransport()
    expect(useStudioStore.getState().isPlaying).toBe(true)
  })

  it("playTransport does not restart if already playing", () => {
    playTransport()
    const playhead1 = useStudioStore.getState().playhead
    playTransport() // should be no-op
    expect(useStudioStore.getState().isPlaying).toBe(true)
  })

  it("stopTransport sets isPlaying to false", () => {
    playTransport()
    stopTransport()
    expect(useStudioStore.getState().isPlaying).toBe(false)
  })

  it("recordTransport sets isRecording to true and starts playing", () => {
    recordTransport()
    expect(useStudioStore.getState().isRecording).toBe(true)
    expect(useStudioStore.getState().isPlaying).toBe(true)
  })

  it("stopRecording sets isRecording to false", () => {
    recordTransport()
    stopRecording()
    expect(useStudioStore.getState().isRecording).toBe(false)
    // playing should still be true
    expect(useStudioStore.getState().isPlaying).toBe(true)
  })

  it("stopTransport cancels animation frame", () => {
    const spy = vi.spyOn(globalThis, "cancelAnimationFrame")
    playTransport()
    stopTransport()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
