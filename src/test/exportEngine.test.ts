import { describe, it, expect, vi } from "vitest"
import { bufferToWav, normalizeBuffer } from "@/audio/ExportEngine"

vi.mock("tone", () => ({}))

function fakeBuffer(channels: number[][], sampleRate = 48000): AudioBuffer {
  const data = channels.map((c) => Float32Array.from(c))
  return {
    numberOfChannels: data.length,
    sampleRate,
    length: data[0].length,
    duration: data[0].length / sampleRate,
    getChannelData: (ch: number) => data[ch],
  } as unknown as AudioBuffer
}

// jsdom's Blob has no arrayBuffer(); read it with FileReader instead
function view(blob: Blob): Promise<DataView> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new DataView(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

describe("bufferToWav bit depths", () => {
  it("writes 24-bit PCM", async () => {
    const v = await view(bufferToWav(fakeBuffer([[1, -1, 0]]), 24))
    expect(v.getUint16(20, true)).toBe(1) // PCM
    expect(v.getUint16(34, true)).toBe(24)
    expect(v.getUint32(40, true)).toBe(9) // 3 samples × 3 bytes
    const s0 = v.getUint8(44) | (v.getUint8(45) << 8) | (v.getUint8(46) << 16)
    expect(s0).toBe(0x7fffff)
    const s1 = v.getUint8(47) | (v.getUint8(48) << 8) | (v.getUint8(49) << 16)
    expect(s1).toBe(0x800000) // -1 in 24-bit two's complement
  })

  it("writes 32-bit IEEE float", async () => {
    const v = await view(bufferToWav(fakeBuffer([[0.5], [-0.25]]), 32))
    expect(v.getUint16(20, true)).toBe(3) // IEEE float
    expect(v.getUint16(34, true)).toBe(32)
    expect(v.getFloat32(44, true)).toBeCloseTo(0.5)
    expect(v.getFloat32(48, true)).toBeCloseTo(-0.25)
  })

  it("keeps 16-bit as the default", async () => {
    const v = await view(bufferToWav(fakeBuffer([[0]])))
    expect(v.getUint16(34, true)).toBe(16)
  })
})

describe("normalizeBuffer", () => {
  it("scales the loudest sample to the target peak", () => {
    const buf = fakeBuffer([[0.25, -0.5], [0.1, 0]])
    normalizeBuffer(buf, 1)
    expect(buf.getChannelData(0)[1]).toBeCloseTo(-1)
    expect(buf.getChannelData(0)[0]).toBeCloseTo(0.5)
    expect(buf.getChannelData(1)[0]).toBeCloseTo(0.2)
  })

  it("leaves silence untouched", () => {
    const buf = fakeBuffer([[0, 0]])
    normalizeBuffer(buf)
    expect(Array.from(buf.getChannelData(0))).toEqual([0, 0])
  })
})
