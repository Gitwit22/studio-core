/** Min/max peak pairs for a single audio channel. */
export interface ChannelPeaks {
  min: number[]
  max: number[]
}

/** Waveform peak data at a single resolution level. */
export interface PeakResolution {
  samplesPerPeak: number
  channels: ChannelPeaks[]
}

/**
 * Multi-resolution waveform peak data generated from an audio file.
 * Stored once per audio source and persisted for fast reload.
 */
export interface WaveformPeaks {
  version: 1
  sourceId: string
  duration: number
  sampleRate: number
  /** Peak data at multiple resolutions for different zoom levels. */
  resolutions: {
    coarse: PeakResolution   // ~4096 samples/peak — full song overview
    medium: PeakResolution   // ~1024 samples/peak — normal editing
    fine: PeakResolution     // ~256 samples/peak  — close zoom
  }
}

/** Status of waveform generation for an audio source. */
export type WaveformStatus = "pending" | "analyzing" | "ready" | "error"
