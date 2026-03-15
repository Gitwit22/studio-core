import { describe, it, expect } from "vitest"
import {
  computeChannelPeaks,
  computePeakResolution,
  generateWaveformPeaks,
  selectResolution,
  RESOLUTION_SPP,
} from "@/audio/waveformPeaks"

/**
 * Helper: create a minimal AudioBuffer-like object for testing.
 * Vitest jsdom does not provide a real AudioBuffer, so we mock the interface.
 */
function createMockAudioBuffer(
  channelData: Float32Array[],
  sampleRate = 44100,
): AudioBuffer {
  const length = channelData[0]?.length ?? 0
  return {
    length,
    duration: length / sampleRate,
    sampleRate,
    numberOfChannels: channelData.length,
    getChannelData(ch: number) {
      return channelData[ch]
    },
    copyFromChannel() {},
    copyToChannel() {},
  } as unknown as AudioBuffer
}

describe("computeChannelPeaks", () => {
  it("computes correct min/max for simple samples", () => {
    const samples = new Float32Array([0.1, 0.5, -0.3, 0.2, -0.8, 0.9])
    const peaks = computeChannelPeaks(samples, 3)

    expect(peaks.min).toHaveLength(2)
    expect(peaks.max).toHaveLength(2)

    // First block: [0.1, 0.5, -0.3]
    expect(peaks.min[0]).toBeCloseTo(-0.3)
    expect(peaks.max[0]).toBeCloseTo(0.5)

    // Second block: [0.2, -0.8, 0.9]
    expect(peaks.min[1]).toBeCloseTo(-0.8)
    expect(peaks.max[1]).toBeCloseTo(0.9)
  })

  it("handles partial last block", () => {
    const samples = new Float32Array([0.1, -0.2, 0.3, 0.4, -0.5])
    const peaks = computeChannelPeaks(samples, 3)

    // 5 samples / 3 spp = ceil(1.67) = 2 peaks
    expect(peaks.min).toHaveLength(2)
    expect(peaks.max).toHaveLength(2)

    // Last block: [0.4, -0.5]
    expect(peaks.min[1]).toBeCloseTo(-0.5)
    expect(peaks.max[1]).toBeCloseTo(0.4)
  })

  it("handles single sample per peak", () => {
    const samples = new Float32Array([0.5, -0.3, 0.8])
    const peaks = computeChannelPeaks(samples, 1)

    expect(peaks.min).toHaveLength(3)
    expect(peaks.max).toHaveLength(3)
    expect(peaks.max[0]).toBeCloseTo(0.5)
    expect(peaks.min[1]).toBeCloseTo(-0.3)
    expect(peaks.max[2]).toBeCloseTo(0.8)
  })

  it("handles all-zero samples", () => {
    const samples = new Float32Array(100)
    const peaks = computeChannelPeaks(samples, 10)

    expect(peaks.min).toHaveLength(10)
    expect(peaks.max).toHaveLength(10)
    peaks.min.forEach((v) => expect(v).toBe(0))
    peaks.max.forEach((v) => expect(v).toBe(0))
  })

  it("handles very small block size", () => {
    const samples = new Float32Array([1.0])
    const peaks = computeChannelPeaks(samples, 1)
    expect(peaks.min).toHaveLength(1)
    expect(peaks.max).toHaveLength(1)
    expect(peaks.max[0]).toBeCloseTo(1.0)
    // min defaults to 0 since 1.0 > 0
    expect(peaks.min[0]).toBe(0)
  })
})

describe("computePeakResolution", () => {
  it("processes mono audio buffer", () => {
    const data = new Float32Array(1000)
    for (let i = 0; i < 1000; i++) {
      data[i] = Math.sin(i * 0.1)
    }
    const buffer = createMockAudioBuffer([data])
    const resolution = computePeakResolution(buffer, 100)

    expect(resolution.samplesPerPeak).toBe(100)
    expect(resolution.channels).toHaveLength(1)
    expect(resolution.channels[0].min).toHaveLength(10)
    expect(resolution.channels[0].max).toHaveLength(10)
  })

  it("processes stereo audio buffer with separate channels", () => {
    const left = new Float32Array([0.1, -0.5, 0.3])
    const right = new Float32Array([0.2, -0.4, 0.6])
    const buffer = createMockAudioBuffer([left, right])
    const resolution = computePeakResolution(buffer, 3)

    expect(resolution.channels).toHaveLength(2)
    // Left channel
    expect(resolution.channels[0].min[0]).toBeCloseTo(-0.5)
    expect(resolution.channels[0].max[0]).toBeCloseTo(0.3)
    // Right channel
    expect(resolution.channels[1].min[0]).toBeCloseTo(-0.4)
    expect(resolution.channels[1].max[0]).toBeCloseTo(0.6)
  })
})

describe("generateWaveformPeaks", () => {
  it("returns multi-resolution peaks with correct metadata", () => {
    const data = new Float32Array(44100) // 1 second at 44100 Hz
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin((2 * Math.PI * 440 * i) / 44100) * 0.8
    }
    const buffer = createMockAudioBuffer([data], 44100)
    const peaks = generateWaveformPeaks("source-123", buffer)

    expect(peaks.version).toBe(1)
    expect(peaks.sourceId).toBe("source-123")
    expect(peaks.sampleRate).toBe(44100)
    expect(peaks.duration).toBeCloseTo(1.0)

    // Check resolutions exist and have correct samplesPerPeak
    expect(peaks.resolutions.coarse.samplesPerPeak).toBe(RESOLUTION_SPP.coarse)
    expect(peaks.resolutions.medium.samplesPerPeak).toBe(RESOLUTION_SPP.medium)
    expect(peaks.resolutions.fine.samplesPerPeak).toBe(RESOLUTION_SPP.fine)

    // Fine resolution should have more peaks than coarse
    const coarsePeakCount = peaks.resolutions.coarse.channels[0].min.length
    const mediumPeakCount = peaks.resolutions.medium.channels[0].min.length
    const finePeakCount = peaks.resolutions.fine.channels[0].min.length
    expect(finePeakCount).toBeGreaterThan(mediumPeakCount)
    expect(mediumPeakCount).toBeGreaterThan(coarsePeakCount)
  })

  it("peak values are within -1 to 1 range", () => {
    const data = new Float32Array(8192)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin(i * 0.05) * 0.9
    }
    const buffer = createMockAudioBuffer([data])
    const peaks = generateWaveformPeaks("src-test", buffer)

    for (const resolution of Object.values(peaks.resolutions)) {
      for (const channel of resolution.channels) {
        for (const v of channel.min) {
          expect(v).toBeGreaterThanOrEqual(-1)
          expect(v).toBeLessThanOrEqual(1)
        }
        for (const v of channel.max) {
          expect(v).toBeGreaterThanOrEqual(-1)
          expect(v).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe("selectResolution", () => {
  function makePeaks(): ReturnType<typeof generateWaveformPeaks> {
    const data = new Float32Array(44100)
    const buffer = createMockAudioBuffer([data])
    return generateWaveformPeaks("test", buffer)
  }

  it("selects coarse for low zoom", () => {
    const peaks = makePeaks()
    const resolution = selectResolution(peaks, 0.5)
    expect(resolution.samplesPerPeak).toBe(RESOLUTION_SPP.coarse)
  })

  it("selects medium for normal zoom", () => {
    const peaks = makePeaks()
    const resolution = selectResolution(peaks, 1)
    expect(resolution.samplesPerPeak).toBe(RESOLUTION_SPP.medium)
  })

  it("selects fine for high zoom", () => {
    const peaks = makePeaks()
    const resolution = selectResolution(peaks, 2)
    expect(resolution.samplesPerPeak).toBe(RESOLUTION_SPP.fine)
  })

  it("selects fine for very high zoom", () => {
    const peaks = makePeaks()
    const resolution = selectResolution(peaks, 3)
    expect(resolution.samplesPerPeak).toBe(RESOLUTION_SPP.fine)
  })
})
