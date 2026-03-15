import type { ChannelPeaks, PeakResolution, WaveformPeaks } from "@/studio/types/waveform"

/** Default samples-per-peak for each resolution tier. */
export const RESOLUTION_SPP = {
  coarse: 4096,
  medium: 1024,
  fine: 256,
} as const

/**
 * Compute min/max peaks for a single channel of raw samples.
 * @param samples  Float32Array of PCM sample data
 * @param samplesPerPeak  Number of raw samples per one peak bucket
 * @returns ChannelPeaks with min[] and max[] arrays
 */
export function computeChannelPeaks(
  samples: Float32Array,
  samplesPerPeak: number,
): ChannelPeaks {
  const numPeaks = Math.ceil(samples.length / samplesPerPeak)
  const min = new Array<number>(numPeaks)
  const max = new Array<number>(numPeaks)

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPeak
    const end = Math.min(start + samplesPerPeak, samples.length)
    let lo = 0
    let hi = 0
    for (let j = start; j < end; j++) {
      const v = samples[j]
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    min[i] = lo
    max[i] = hi
  }

  return { min, max }
}

/**
 * Build a PeakResolution from an AudioBuffer at a given samples-per-peak rate.
 * For multi-channel audio, each channel is computed independently.
 * @param buffer  Decoded AudioBuffer
 * @param samplesPerPeak  Samples per one peak bucket
 */
export function computePeakResolution(
  buffer: AudioBuffer,
  samplesPerPeak: number,
): PeakResolution {
  const channels: ChannelPeaks[] = []
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    channels.push(computeChannelPeaks(buffer.getChannelData(ch), samplesPerPeak))
  }
  return { samplesPerPeak, channels }
}

/**
 * Generate full multi-resolution WaveformPeaks from a decoded AudioBuffer.
 * @param sourceId  Unique ID of the AudioSource this waveform belongs to
 * @param buffer    Decoded AudioBuffer from Web Audio API
 */
export function generateWaveformPeaks(
  sourceId: string,
  buffer: AudioBuffer,
): WaveformPeaks {
  return {
    version: 1,
    sourceId,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    resolutions: {
      coarse: computePeakResolution(buffer, RESOLUTION_SPP.coarse),
      medium: computePeakResolution(buffer, RESOLUTION_SPP.medium),
      fine: computePeakResolution(buffer, RESOLUTION_SPP.fine),
    },
  }
}

/**
 * Decode an audio File/Blob and generate waveform peaks.
 * Uses the offline AudioContext to decode the file's array buffer.
 * @param sourceId  Unique ID of the AudioSource
 * @param file      Audio File or Blob to decode
 */
export async function generatePeaksFromFile(
  sourceId: string,
  file: Blob,
): Promise<WaveformPeaks> {
  const arrayBuffer = await file.arrayBuffer()
  const audioCtx = new OfflineAudioContext(1, 1, 44100)
  const buffer = await audioCtx.decodeAudioData(arrayBuffer)
  return generateWaveformPeaks(sourceId, buffer)
}

/**
 * Decode audio from a URL and generate waveform peaks.
 * @param sourceId  Unique ID of the AudioSource
 * @param url       URL to the audio resource
 */
export async function generatePeaksFromUrl(
  sourceId: string,
  url: string,
): Promise<WaveformPeaks> {
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  const audioCtx = new OfflineAudioContext(1, 1, 44100)
  const buffer = await audioCtx.decodeAudioData(arrayBuffer)
  return generateWaveformPeaks(sourceId, buffer)
}

/**
 * Select the best resolution tier based on the current zoom level.
 * Higher zoom → finer resolution for more detail.
 */
export function selectResolution(
  peaks: WaveformPeaks,
  zoom: number,
): PeakResolution {
  if (zoom >= 2) return peaks.resolutions.fine
  if (zoom >= 1) return peaks.resolutions.medium
  return peaks.resolutions.coarse
}
