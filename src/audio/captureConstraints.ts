import { toast } from "sonner"

/** What the browser actually gave us for a capture track (from getSettings()). */
export interface CaptureReport {
  deviceLabel: string
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
  sampleRate?: number
  channelCount?: number
  /** Input latency in seconds, when the browser reports it */
  latency?: number
  /** Names of voice-call processing still switched on despite our request */
  processingActive: string[]
}

/**
 * Constraints for music capture. Browsers default to call-style processing
 * (echo cancellation, noise suppression, automatic gain) which gates, pumps
 * and thins out vocals and instruments — ask for all of it to be off.
 * Support varies by browser and device, so callers must check the result with
 * inspectCapture() rather than assume it was honoured.
 */
export function buildCaptureConstraints(deviceId: string | null | undefined, stereo: boolean): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: stereo ? 2 : 1 },
    // Not in every lib.dom version; browsers that don't know it ignore it.
    ...({ latency: { ideal: 0 } } as MediaTrackConstraints),
  }
}

const PROCESSING_LABELS = {
  echoCancellation: "echo cancellation",
  noiseSuppression: "noise suppression",
  autoGainControl: "automatic gain control",
} as const

export function inspectCapture(stream: MediaStream): CaptureReport {
  const track = stream.getAudioTracks?.()[0]
  const settings = (track?.getSettings?.() ?? {}) as MediaTrackSettings & { latency?: number }
  const processingActive = (Object.keys(PROCESSING_LABELS) as (keyof typeof PROCESSING_LABELS)[])
    .filter((key) => settings[key] === true)
    .map((key) => PROCESSING_LABELS[key])
  return {
    deviceLabel: track?.label || "Default microphone",
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl,
    sampleRate: settings.sampleRate,
    channelCount: settings.channelCount,
    latency: typeof settings.latency === "number" ? settings.latency : undefined,
    processingActive,
  }
}

export async function openCaptureStream(
  deviceId: string | null | undefined,
  stereo: boolean,
): Promise<{ stream: MediaStream; report: CaptureReport }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: buildCaptureConstraints(deviceId, stereo) })
  return { stream, report: inspectCapture(stream) }
}

const warnedDevices = new Set<string>()

/** Tell the user (once per device) when the browser kept voice processing on. */
export function warnIfProcessingActive(report: CaptureReport): void {
  if (report.processingActive.length === 0 || warnedDevices.has(report.deviceLabel)) return
  warnedDevices.add(report.deviceLabel)
  toast.warning(`This browser kept ${report.processingActive.join(", ")} on for "${report.deviceLabel}".`, {
    description: "Recordings may sound processed. Try another browser or audio interface for clean capture.",
    duration: 10_000,
  })
}
