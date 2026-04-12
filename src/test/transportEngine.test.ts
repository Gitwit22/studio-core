import { describe, it, expect, beforeEach, vi } from "vitest"
import { useStudioStore } from "@/studio/engine/studioStore"

// Mock Tone.js
vi.mock("tone", () => ({
  start: vi.fn().mockResolvedValue(undefined),
  getTransport: vi.fn().mockReturnValue({
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    bpm: { value: 120 },
    position: "0:0:0",
  }),
  Player: vi.fn().mockImplementation(() => ({
    toDestination: vi.fn().mockReturnThis(),
    sync: vi.fn().mockReturnValue({ start: vi.fn() }),
    stop: vi.fn(),
    unsync: vi.fn(),
    dispose: vi.fn(),
  })),
  Gain: vi.fn().mockImplementation(() => ({
    toDestination: vi.fn().mockReturnThis(),
    connect: vi.fn(),
  })),
  Meter: vi.fn().mockImplementation(() => ({
    getValue: vi.fn().mockReturnValue(-60),
    connect: vi.fn(),
  })),
  UserMedia: vi.fn().mockImplementation(() => ({
    open: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
  })),
}))

// Mock AudioEngine
vi.mock("@/audio/AudioEngine", () => ({
  audioEngine: {
    init: vi.fn().mockResolvedValue(undefined),
    contextStarted: true,
    reset: vi.fn(),
  },
}))

import {
  playTransport,
  stopTransport,
  recordTransport,
  stopRecording,
} from "@/studio/engine/transportEngine"

describe("transportEngine", () => {
  beforeEach(() => {
    useStudioStore.setState({
      isPlaying: false,
      isRecording: false,
      isPaused: false,
      playhead: 0,
      bpm: 120,
      loop: { start: 0, end: 8, enabled: false },
      tracks: [],
      clips: [],
      sources: [],
    })

    // Mock MediaRecorder + getUserMedia for record tests
    globalThis.MediaRecorder = vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null,
      onstop: null,
      state: "inactive",
    })) as unknown as typeof MediaRecorder
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
      writable: true,
      configurable: true,
    })
  })

  it("playTransport sets isPlaying to true", async () => {
    await playTransport()
    expect(useStudioStore.getState().isPlaying).toBe(true)
  })

  it("playTransport does not restart if already playing", async () => {
    await playTransport()
    await playTransport() // should be no-op
    expect(useStudioStore.getState().isPlaying).toBe(true)
  })

  it("stopTransport sets isPlaying to false", async () => {
    await playTransport()
    stopTransport()
    expect(useStudioStore.getState().isPlaying).toBe(false)
  })

  it("recordTransport sets isRecording to true and starts playing", async () => {
    // Arm a track first
    const id = useStudioStore.getState().addTrack("audio", "Test")
    useStudioStore.getState().updateTrack(id, { armed: true })
    await recordTransport()
    expect(useStudioStore.getState().isRecording).toBe(true)
    expect(useStudioStore.getState().isPlaying).toBe(true)
  })

  it("stopRecording sets isRecording to false", async () => {
    const id = useStudioStore.getState().addTrack("audio", "Test")
    useStudioStore.getState().updateTrack(id, { armed: true })
    await recordTransport()
    stopRecording()
    expect(useStudioStore.getState().isRecording).toBe(false)
  })

  it("stopTransport cancels animation frame", async () => {
    const spy = vi.spyOn(globalThis, "cancelAnimationFrame")
    await playTransport()
    stopTransport()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
