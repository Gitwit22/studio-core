import { describe, it, expect, vi, beforeAll } from "vitest"
import { buildCaptureConstraints, inspectCapture } from "@/audio/captureConstraints"
import { computeRecordPlacement } from "@/audio/recordPlacement"
import { assembleChunks } from "@/audio/PcmRecorder"

vi.mock("tone", () => ({}))
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }))

describe("buildCaptureConstraints", () => {
  it("turns off voice-call processing and asks for mono by default", () => {
    const c = buildCaptureConstraints(null, false)
    expect(c).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 1 },
    })
    expect(c.deviceId).toBeUndefined()
  })

  it("pins the chosen device and channel count", () => {
    const c = buildCaptureConstraints("dev-1", true)
    expect(c.deviceId).toEqual({ exact: "dev-1" })
    expect(c.channelCount).toEqual({ ideal: 2 })
  })
})

describe("inspectCapture", () => {
  const streamWith = (settings: Record<string, unknown>) =>
    ({ getAudioTracks: () => [{ label: "USB Mic", getSettings: () => settings }] }) as unknown as MediaStream

  it("reports clean capture when the browser honoured the request", () => {
    const r = inspectCapture(streamWith({ echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000, latency: 0.01 }))
    expect(r.processingActive).toEqual([])
    expect(r).toMatchObject({ deviceLabel: "USB Mic", sampleRate: 48000, latency: 0.01 })
  })

  it("flags processing the browser kept on", () => {
    const r = inspectCapture(streamWith({ echoCancellation: true, noiseSuppression: false, autoGainControl: true }))
    expect(r.processingActive).toEqual(["echo cancellation", "automatic gain control"])
  })

  it("copes with streams that expose no settings", () => {
    const r = inspectCapture({ getTracks: () => [] } as unknown as MediaStream)
    expect(r.processingActive).toEqual([])
    expect(r.deviceLabel).toBe("Default microphone")
  })
})

describe("computeRecordPlacement", () => {
  const base = { transportStartBeat: 0, transportStartTime: 10, durationSec: 4, bpm: 120, latencySec: 0 }

  it("places a take captured at transport start on the start beat", () => {
    expect(computeRecordPlacement({ ...base, firstFrameTime: 10 })).toEqual({ start: 0, end: 8, offset: 0 })
  })

  it("respects a non-zero start playhead and capture delay", () => {
    // started at beat 16; capture began 0.5 s (1 beat) after the transport
    expect(computeRecordPlacement({ ...base, transportStartBeat: 16, firstFrameTime: 10.5 })).toEqual({ start: 17, end: 25, offset: 0 })
  })

  it("compensates round-trip latency by moving the take earlier", () => {
    // 0.25 s latency at 120 bpm = 0.5 beat earlier
    expect(computeRecordPlacement({ ...base, transportStartBeat: 8, firstFrameTime: 10, latencySec: 0.25 })).toEqual({ start: 7.5, end: 15.5, offset: 0 })
  })

  it("trims audio that would land before beat 0 via the clip offset (source untouched)", () => {
    // pre-roll captured 0.1 s before the transport started at beat 0
    const p = computeRecordPlacement({ ...base, firstFrameTime: 9.9 })
    expect(p.start).toBe(0)
    expect(p.offset).toBeCloseTo(0.2)
    expect(p.end).toBeCloseTo(7.8)
  })
})

describe("assembleChunks", () => {
  it("concatenates chunk data and derives the first-sample time", () => {
    const take = assembleChunks(
      [
        { channels: [Float32Array.from([1, 2, 0, 0])], frames: 2, startFrame: 48000 },
        { channels: [Float32Array.from([3])], frames: 1, startFrame: 48002 },
      ],
      48000,
    )
    expect(Array.from(take.channels[0])).toEqual([1, 2, 3])
    expect(take.frames).toBe(3)
    expect(take.firstFrameTime).toBe(1)
  })
})

describe("capture worklet processor", () => {
  type Msg = { type: string; channels?: Float32Array[]; frames?: number; startFrame?: number; peak?: number; clipped?: boolean }
  let Processor: new (options: unknown) => { process(inputs: Float32Array[][]): boolean; port: { onmessage: (e: { data: unknown }) => void } }
  const posted: Msg[] = []

  beforeAll(async () => {
    const g = globalThis as Record<string, unknown>
    g.AudioWorkletProcessor = class {
      port = { postMessage: (m: Msg) => posted.push(m), onmessage: null as unknown }
    }
    g.registerProcessor = (_name: string, cls: typeof Processor) => { Processor = cls }
    g.currentFrame = 0
    await import("@/audio/worklets/capture-processor.js")
  })

  it("emits full chunks with exact samples, timing and levels, then flushes the tail on stop", () => {
    posted.length = 0
    const p = new Processor({ channelCount: 1, processorOptions: { chunkFrames: 4 } })
    const g = globalThis as Record<string, unknown>
    g.currentFrame = 100
    p.process([[Float32Array.from([0.1, -0.5, 0.2])]])
    g.currentFrame = 103
    p.process([[Float32Array.from([1, 0.3, 0.4])]])
    expect(posted).toHaveLength(1)
    expect(Array.from(posted[0].channels![0])).toEqual([0.1, -0.5, 0.2, 1].map(Math.fround))
    expect(posted[0]).toMatchObject({ frames: 4, startFrame: 100, peak: 1, clipped: true })

    p.port.onmessage({ data: "stop" })
    expect(posted[1]).toMatchObject({ type: "chunk", frames: 2, startFrame: 104, clipped: false })
    expect(Array.from(posted[1].channels![0]).slice(0, 2)).toEqual([0.3, 0.4].map(Math.fround))
    expect(posted[2]).toEqual({ type: "done" })
    expect(p.process([[Float32Array.from([0])]])).toBe(false)
  })

  it("waits without data instead of recording silence", () => {
    posted.length = 0
    const p = new Processor({ channelCount: 1, processorOptions: { chunkFrames: 4 } })
    expect(p.process([[]])).toBe(true)
    p.port.onmessage({ data: "stop" })
    expect(posted).toEqual([{ type: "done" }])
  })
})
