import * as Tone from "tone"
import { toast } from "sonner"
import { useStudioStore } from "./studioStore"
import { audioEngine } from "@/audio/AudioEngine"
import { mixerEngine } from "@/audio/MixerEngine"
import { Recorder } from "@/audio/Recorder"
import { PcmRecorder, type PcmChunk } from "@/audio/PcmRecorder"
import { openCaptureStream, warnIfProcessingActive, type CaptureReport } from "@/audio/captureConstraints"
import { computeRecordPlacement } from "@/audio/recordPlacement"
import { encodeWav } from "@/audio/ExportEngine"
import { persistenceService } from "../persistence"
import {
  beginTake,
  updateTakeMeta,
  appendTakeChunk,
  listOrphanTakes,
  loadTake,
  deleteTake,
  type TakeMeta,
} from "../persistence/takeJournal"
import { getStudioSettings } from "../settings/studioSettings"
import { useInputMeter } from "./inputMeter"
import type { SourceCaptureInfo } from "../types/studio"

// ── Internal state ──
let animationFrame: number | null = null
let lastTime = 0
interface ActivePlayer { player: Tone.Player; gain: Tone.Gain }
let activePlayers: ActivePlayer[] = []
const recorder = new Recorder()
let micStream: MediaStream | null = null
let metronome: { loop: Tone.Loop; synth: Tone.Synth } | null = null
/** Context time and playhead of the most recent transport start — the reference for placing takes */
let lastTransportStart: { time: number; beat: number } | null = null

// ── Playback ──

export async function playTransport() {
  const store = useStudioStore.getState()
  if (store.isPlaying) return

  await audioEngine.init()

  // Sync Tone BPM
  Tone.getTransport().bpm.value = store.bpm

  // Build players for clips that have audio sources
  disposeActivePlayers()
  const { clips, sources, tracks } = store

  const loadPromises: Promise<void>[] = []

  for (const clip of clips) {
    const src = sources.find((s) => s.id === clip.sourceId)
    if (!src?.url) continue
    const track = tracks.find((t) => t.id === clip.trackId)
    if (!track) continue

    // Route each player through the track's mixer channel
    const channel = mixerEngine.getInput(track.id)

    const player = new Tone.Player(src.url)

    // Apply per-clip gain (0–2 multiplier, default 1)
    const clipGain = new Tone.Gain(clip.gain ?? 1)
    player.connect(clipGain)
    if (channel) {
      clipGain.connect(channel)
    } else {
      clipGain.toDestination()
    }
    activePlayers.push({ player, gain: clipGain })

    // Apply playback rate for time-stretch
    const rate = clip.playbackRate ?? 1;
    player.playbackRate = rate;

    const beatsPerSec = store.bpm / 60;
    const startSec = clip.start / beatsPerSec;
    const clipDurationSec = (clip.end - clip.start) / beatsPerSec;
    const offsetSec = (clip.offset ?? 0) / beatsPerSec;

    player.sync().start(startSec, offsetSec, clipDurationSec);

    // Schedule fade-in / fade-out via player volume envelope
    const fadeIn = clip.fadeInDuration ?? 0;
    const fadeOut = clip.fadeOutDuration ?? 0;
    if (fadeIn > 0) {
      const fadeInSec = fadeIn / beatsPerSec;
      player.fadeIn = fadeInSec;
    }
    if (fadeOut > 0) {
      const fadeOutSec = fadeOut / beatsPerSec;
      player.fadeOut = fadeOutSec;
    }

    // Collect load promises so we wait for all buffers
    loadPromises.push(
      new Promise<void>((resolve) => {
        if (player.loaded) {
          resolve()
        } else {
          player.buffer.onload = () => resolve()
          // Fallback timeout so we don't hang
          setTimeout(resolve, 5000)
        }
      })
    )
  }

  // Wait for all players to load their audio buffers
  if (loadPromises.length > 0) {
    await Promise.all(loadPromises)
  }

  if (getStudioSettings().metronome) startMetronome()

  const startAt = Tone.now()
  Tone.getTransport().start(startAt, `${store.playhead / (store.bpm / 60)}`)
  lastTransportStart = { time: startAt, beat: store.playhead }

  useStudioStore.getState().setPlaying(true)
  useStudioStore.getState().setPaused(false)
  lastTime = performance.now()

  const tick = (now: number) => {
    const state = useStudioStore.getState()
    if (!state.isPlaying) return

    const deltaSeconds = (now - lastTime) / 1000
    lastTime = now

    const beatsPerSecond = state.bpm / 60
    const nextPlayhead = state.playhead + deltaSeconds * beatsPerSecond

    if (state.loop.enabled && nextPlayhead >= state.loop.end) {
      state.setPlayhead(state.loop.start)
    } else {
      state.setPlayhead(nextPlayhead)
    }

    animationFrame = requestAnimationFrame(tick)
  }

  animationFrame = requestAnimationFrame(tick)
}

export function pauseTransport() {
  const store = useStudioStore.getState()
  if (!store.isPlaying) return
  // A take's placement assumes the transport ran continuously while capturing
  if (store.isRecording) void stopRecording()

  Tone.getTransport().pause()
  store.setPlaying(false)
  store.setPaused(true)
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = null
  // Playhead stays where it is
}

export function stopTransport() {
  try { Tone.getTransport().stop() } catch { /* Tone not started yet */ }
  useStudioStore.getState().setPlaying(false)
  useStudioStore.getState().setPaused(false)
  useStudioStore.getState().setPlayhead(0)
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = null
  disposeActivePlayers()
  disposeMetronome()
}

export function rewindTransport() {
  useStudioStore.getState().setPlayhead(0)
  if (useStudioStore.getState().isPlaying) {
    try {
      Tone.getTransport().stop()
      Tone.getTransport().start()
    } catch { /* Tone not started */ }
  }
}

// ── Recording ──
//
// Signal flow:  mic ─┬─► capture worklet ─► untouched Float32 take (WAV) ─► timeline
//                    └─► (optional) armed track's FX ─► outputs   [monitoring only]
// Nothing on the monitoring branch ever reaches the stored take.

const JOURNAL_FLUSH_MS = 1000
/** Warn when this much captured audio has not reached crash-recovery storage yet */
const BACKLOG_WARN_SECONDS = 10

interface ActiveTake {
  takeId: string
  projectId: string
  trackId: string
  trackName: string
  trackColor?: string
  bpm: number
  transportStartBeat: number
  transportStartTime: number
  latencySec: number
  report: CaptureReport
  stream: MediaStream
  pcm: PcmRecorder | null
  /** Context time recording began (fallback recorder has no per-sample timing) */
  fallbackStartTime: number
  monitor: { source: AudioNode; input: Tone.InputNode } | null
  journal: {
    enabled: boolean
    seq: number
    pending: PcmChunk[]
    receivedFrames: number
    persistedFrames: number
    writing: Promise<void>
    timer: ReturnType<typeof setInterval> | null
    backlogWarned: boolean
  }
}

let activeTake: ActiveTake | null = null
let recordingStarting = false

export async function recordTransport() {
  const state = useStudioStore.getState()
  if (state.isRecording || recordingStarting) return

  // Ensure there is an armed track
  const armedTrack = state.tracks.find((t) => t.armed)
  if (!armedTrack) {
    console.warn("No track armed for recording")
    toast.error("Arm a track before recording")
    return
  }

  recordingStarting = true
  try {
    const settings = getStudioSettings()
    // Track's own input first, then the default input from Settings, then the browser default
    const inputDeviceId = armedTrack.inputDeviceId ?? settings.inputDeviceId

    // Always request a fresh stream so device selection takes effect
    releaseMic()
    let report: CaptureReport
    try {
      const opened = await openCaptureStream(inputDeviceId, settings.recordStereo)
      micStream = opened.stream
      report = opened.report
    } catch (err) {
      console.warn("Microphone access failed:", err)
      toast.error("Could not open the microphone", { description: err instanceof Error ? err.message : undefined })
      return
    }
    warnIfProcessingActive(report)

    await audioEngine.init()

    // Start playback first so player buffers are loaded and the transport start
    // time is known before capture begins.
    if (!useStudioStore.getState().isPlaying) {
      await playTransport()
    }
    const transportStart = lastTransportStart ?? { time: contextTime(), beat: useStudioStore.getState().playhead }

    const take: ActiveTake = {
      takeId: crypto.randomUUID(),
      projectId: useStudioStore.getState().projectId ?? "none",
      trackId: armedTrack.id,
      trackName: armedTrack.name,
      trackColor: armedTrack.color,
      bpm: useStudioStore.getState().bpm,
      transportStartBeat: transportStart.beat,
      transportStartTime: transportStart.time,
      latencySec: roundTripLatencySec(report),
      report,
      stream: micStream,
      pcm: null,
      fallbackStartTime: 0,
      monitor: null,
      journal: {
        enabled: false, seq: 0, pending: [], receivedFrames: 0, persistedFrames: 0,
        writing: Promise.resolve(), timer: null, backlogWarned: false,
      },
    }

    useInputMeter.getState().reset()

    if (PcmRecorder.isSupported()) {
      const pcm = new PcmRecorder()
      try {
        await pcm.start(micStream, settings.recordStereo ? 2 : 1, (chunk) => onTakeChunk(take, chunk))
        take.pcm = pcm
      } catch (err) {
        console.warn("Lossless capture unavailable, using compressed recorder:", err)
      }
    }
    if (!take.pcm) {
      recorder.start(micStream)
      take.fallbackStartTime = contextTime()
    } else {
      void startJournal(take, (Tone.getContext().rawContext as unknown as AudioContext).sampleRate, settings.recordStereo ? 2 : 1)
    }

    if (settings.monitorInputThroughFX) startMonitoring(take)

    // Release the mic and keep the take if the device disappears mid-take
    micStream.getAudioTracks?.()[0]?.addEventListener("ended", () => {
      if (activeTake === take) {
        toast.error("The input device was disconnected — recording stopped.")
        void stopRecording()
      }
    })

    activeTake = take
    useStudioStore.getState().setRecording(true)
  } finally {
    recordingStarting = false
  }
}

export async function stopRecording() {
  const state = useStudioStore.getState()
  const take = activeTake
  if (!state.isRecording && !take) return

  useStudioStore.getState().setRecording(false)
  activeTake = null
  if (!take) {
    releaseMic()
    return
  }

  stopMonitoring(take)
  if (take.journal.timer) clearInterval(take.journal.timer)

  let blob: Blob
  let durationSeconds: number | null
  let firstFrameTime: number
  let clipped = false
  let captureSampleRate = take.report.sampleRate
  let captureChannels = take.report.channelCount
  if (take.pcm) {
    const pcmTake = await take.pcm.stop()
    // Let journal writes already in flight finish before finalising
    await take.journal.writing.catch(() => {})
    if (pcmTake.frames === 0) {
      releaseMic()
      if (take.journal.enabled) await deleteTake(take.takeId).catch(() => {})
      return
    }
    blob = encodeWav(pcmTake.channels, pcmTake.sampleRate, 32)
    durationSeconds = pcmTake.frames / pcmTake.sampleRate
    firstFrameTime = pcmTake.firstFrameTime
    clipped = pcmTake.clipped
    captureSampleRate = pcmTake.sampleRate
    captureChannels = pcmTake.channels.length
  } else {
    blob = await recorder.stop()
    if (blob.size === 0) {
      releaseMic()
      return
    }
    durationSeconds = await measureDurationSeconds(blob)
    firstFrameTime = take.fallbackStartTime
  }
  releaseMic()

  if (!durationSeconds) {
    console.warn("Recording could not be decoded; no clip created")
    toast.error("Recording could not be decoded, so no clip was added.")
    return
  }

  const saved = await finalizeTake({
    blob,
    durationSeconds,
    firstFrameTime,
    take,
    capture: {
      format: take.pcm ? "wav-float32" : "compressed",
      deviceLabel: take.report.deviceLabel,
      sampleRate: captureSampleRate,
      channelCount: captureChannels,
      processingActive: take.report.processingActive,
      clipped,
      latencyCompensationMs: Math.round(take.latencySec * 1000),
    },
  })

  if (saved && take.journal.enabled) await deleteTake(take.takeId).catch(() => {})
  if (clipped) {
    toast.warning("The take clipped — lower the input gain on your interface and record again for a clean take.")
  }
}

interface FinalizeParams {
  blob: Blob
  durationSeconds: number
  firstFrameTime: number
  take: Pick<ActiveTake, "trackId" | "trackName" | "trackColor" | "bpm" | "transportStartBeat" | "transportStartTime" | "latencySec">
  capture: SourceCaptureInfo
  name?: string
}

/** Save a take's audio and add it to the timeline as a new source + clip (one undo step). */
async function finalizeTake(p: FinalizeParams): Promise<boolean> {
  const ext = p.blob.type.includes("wav") ? "wav" : extensionForMime(p.blob.type)
  const recordingName = `recording-${Date.now()}.${ext}`
  let url: string
  let savedRelativePath: string | undefined
  try {
    const savedPath = await persistenceService.saveAudio(recordingName, p.blob)
    if (savedPath.startsWith("audio/")) {
      savedRelativePath = savedPath
      url = await persistenceService.loadAudio(savedPath)
    } else {
      url = savedPath
    }
  } catch (err) {
    console.warn("Saving recording failed:", err)
    toast.error("The recording could not be saved to the project", {
      description: "It is on the timeline for now — save the session again before closing.",
    })
    url = URL.createObjectURL(p.blob)
  }

  const placement = computeRecordPlacement({
    transportStartBeat: p.take.transportStartBeat,
    transportStartTime: p.take.transportStartTime,
    firstFrameTime: p.firstFrameTime,
    durationSec: p.durationSeconds,
    bpm: p.take.bpm,
    latencySec: p.take.latencySec,
  })
  if (placement.end <= placement.start) {
    toast.error("The take was entirely before the start of the timeline, so no clip was added.")
    return Boolean(savedRelativePath)
  }

  const store = useStudioStore.getState()
  store.pushUndo()

  const sourceId = store.addSource({
    name: p.name ?? `Recording ${store.sources.length + 1}`,
    url,
    relativePath: savedRelativePath,
    duration: p.durationSeconds,
    capture: p.capture,
  })
  if (!sourceId) {
    toast.error("Session audio limit reached — save and start a new session to keep recording.")
    return Boolean(savedRelativePath)
  }

  // The track may have been deleted meanwhile (e.g. during recovery) — never drop the take
  const trackId = useStudioStore.getState().tracks.some((t) => t.id === p.take.trackId)
    ? p.take.trackId
    : useStudioStore.getState().addTrack("audio", p.take.trackName)

  useStudioStore.getState().addClip({
    trackId,
    sourceId,
    start: placement.start,
    end: placement.end,
    offset: placement.offset,
    name: p.take.trackName,
    color: p.take.trackColor,
  })

  persistenceService.markDirty()
  await persistenceService.immediateSaveIfDirty()
  return Boolean(savedRelativePath)
}

// ── Crash recovery ──

function onTakeChunk(take: ActiveTake, chunk: PcmChunk) {
  useInputMeter.getState().update(take.trackId, chunk.peak, chunk.clipped)
  take.journal.receivedFrames += chunk.frames
  if (take.journal.enabled) take.journal.pending.push(chunk)
}

async function startJournal(take: ActiveTake, sampleRate: number, channelCount: number) {
  const meta: TakeMeta = {
    takeId: take.takeId,
    projectId: take.projectId,
    trackId: take.trackId,
    trackName: take.trackName,
    sampleRate,
    channelCount,
    bpm: take.bpm,
    transportStartBeat: take.transportStartBeat,
    transportStartTime: take.transportStartTime,
    latencySec: take.latencySec,
    firstFrameTime: null,
    startedAt: Date.now(),
  }
  try {
    await beginTake(meta)
  } catch (err) {
    console.warn("Crash-recovery journal unavailable:", err)
    toast.warning("Crash-recovery backup is unavailable for this take — it is recorded in memory only.")
    return
  }
  take.journal.enabled = true
  take.journal.timer = setInterval(() => flushJournal(take, sampleRate), JOURNAL_FLUSH_MS)
}

/** Write captured-but-unpersisted audio to the journal (main thread, never the audio thread). */
function flushJournal(take: ActiveTake, sampleRate: number) {
  const j = take.journal
  if (!j.enabled) return

  const backlogSec = (j.receivedFrames - j.persistedFrames) / sampleRate
  if (backlogSec > BACKLOG_WARN_SECONDS && !j.backlogWarned) {
    j.backlogWarned = true
    toast.warning("Storage is falling behind the recording.", {
      description: "The take is safe in memory — don't close the tab until you stop recording.",
    })
  }
  if (j.pending.length === 0) return

  const batch = j.pending
  j.pending = []
  const isFirst = j.seq === 0
  const seq = j.seq++
  const frames = batch.reduce((n, c) => n + c.frames, 0)
  const channels = Array.from({ length: batch[0].channels.length }, (_, ch) => {
    const out = new Float32Array(frames)
    let o = 0
    for (const c of batch) { out.set(c.channels[ch].subarray(0, c.frames), o); o += c.frames }
    return out
  })
  const firstFrameTime = batch[0].startFrame / sampleRate

  j.writing = j.writing
    .then(async () => {
      if (isFirst) await updateTakeMeta(take.takeId, { firstFrameTime })
      await appendTakeChunk(take.takeId, seq, channels, frames)
      j.persistedFrames += frames
    })
    .catch((err) => {
      if (!j.enabled) return
      j.enabled = false
      console.warn("Crash-recovery write failed:", err)
      toast.warning("Crash-recovery backup stopped (storage error). The take continues in memory.")
    })
}

/**
 * Offer to rebuild takes that were interrupted before they were saved
 * (crash, tab closed, power loss). Call after a session is opened.
 */
export async function recoverInterruptedTakes(): Promise<void> {
  const projectId = useStudioStore.getState().projectId
  if (!projectId || typeof indexedDB === "undefined") return
  let orphans: TakeMeta[]
  try {
    orphans = await listOrphanTakes(projectId)
  } catch {
    return
  }
  for (const meta of orphans) {
    toast.warning(`An interrupted recording on "${meta.trackName}" was found.`, {
      description: `Started ${new Date(meta.startedAt).toLocaleString()}`,
      duration: Infinity,
      action: { label: "Recover", onClick: () => void recoverTake(meta) },
      cancel: { label: "Discard", onClick: () => void deleteTake(meta.takeId).catch(() => {}) },
    })
  }
}

async function recoverTake(meta: TakeMeta) {
  try {
    const { channels, frames } = await loadTake(meta.takeId)
    if (frames === 0) {
      await deleteTake(meta.takeId)
      toast.error("The interrupted recording contained no audio.")
      return
    }
    const saved = await finalizeTake({
      blob: encodeWav(channels, meta.sampleRate, 32),
      durationSeconds: frames / meta.sampleRate,
      firstFrameTime: meta.firstFrameTime ?? meta.transportStartTime,
      take: { ...meta, trackColor: undefined },
      name: `Recovered take (${meta.trackName})`,
      capture: {
        format: "wav-float32",
        deviceLabel: "Recovered",
        sampleRate: meta.sampleRate,
        channelCount: meta.channelCount,
        processingActive: [],
        latencyCompensationMs: Math.round(meta.latencySec * 1000),
      },
    })
    if (saved) await deleteTake(meta.takeId)
    toast.success("Recording recovered")
  } catch (err) {
    console.warn("Recovery failed:", err)
    toast.error("Could not recover the recording", { description: err instanceof Error ? err.message : undefined })
  }
}

// ── Monitoring branch ──

function startMonitoring(take: ActiveTake) {
  try {
    const input = mixerEngine.getInput(take.trackId)
    if (!input) return
    const source = take.pcm?.inputNode ?? Tone.getContext().createMediaStreamSource(take.stream)
    Tone.connect(source, input)
    take.monitor = { source, input }
  } catch (err) {
    console.warn("Input monitoring unavailable:", err)
  }
}

function stopMonitoring(take: ActiveTake) {
  if (!take.monitor) return
  try { Tone.disconnect(take.monitor.source, take.monitor.input) } catch { /* already disconnected */ }
  take.monitor = null
}

// ── Latency ──

/** Output latency (performer hears playback late) + input latency (their sound arrives late) + manual offset. */
function roundTripLatencySec(report: CaptureReport): number {
  let output = 0
  try {
    const raw = Tone.getContext().rawContext as unknown as { baseLatency?: number; outputLatency?: number }
    output = (raw.baseLatency ?? 0) + (raw.outputLatency ?? 0)
  } catch { /* no context */ }
  const input = report.latency ?? 0
  return Math.max(0, output + input + getStudioSettings().recordingOffsetMs / 1000)
}

/** Breakdown for display in Settings (seconds); null before audio has started. */
export function getLatencyEstimate(inputLatencySec?: number): { base: number; output: number; input: number } | null {
  if (!audioEngine.contextStarted) return null
  try {
    const raw = Tone.getContext().rawContext as unknown as { baseLatency?: number; outputLatency?: number }
    return { base: raw.baseLatency ?? 0, output: raw.outputLatency ?? 0, input: inputLatencySec ?? 0 }
  } catch {
    return null
  }
}

function contextTime(): number {
  try {
    return Tone.getContext().currentTime
  } catch {
    return 0
  }
}

function releaseMic() {
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop())
    micStream = null
  }
}

// ── BPM ──

export function setBPM(bpm: number) {
  Tone.getTransport().bpm.value = bpm
  useStudioStore.getState().setBpm(bpm)
}

// ── Position ──

export function getPosition(): string {
  return Tone.getTransport().position as string
}

// ── Internal helpers ──

/**
 * Click on every beat (accented on the bar), synced to the transport and sent
 * straight to the output — never through the mixer, so it is not recorded or
 * exported. Turning the setting off mid-playback silences it immediately.
 */
function startMetronome() {
  disposeMetronome()
  const synth = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
    volume: -12,
  }).toDestination()
  const transport = Tone.getTransport()
  const loop = new Tone.Loop((time) => {
    if (!getStudioSettings().metronome) return
    const beat = Math.round(transport.getTicksAtTime(time) / transport.PPQ)
    synth.triggerAttackRelease(beat % 4 === 0 ? "C6" : "G5", "32n", time)
  }, "4n").start(0)
  metronome = { loop, synth }
}

function disposeMetronome() {
  if (!metronome) return
  try { metronome.loop.dispose(); metronome.synth.dispose() } catch { /* already disposed */ }
  metronome = null
}

function extensionForMime(mime: string): string {
  if (mime.includes("webm")) return "webm"
  if (mime.includes("ogg")) return "ogg"
  if (mime.includes("mp4") || mime.includes("aac")) return "m4a"
  if (mime.includes("wav")) return "wav"
  return "webm"
}

/**
 * Decode the recording to get its real length. HTMLAudioElement metadata is
 * unreliable here: Chrome reports `Infinity` for MediaRecorder webm output
 * (which then serialises as `null` clip ends) and never fires on decode errors.
 */
async function measureDurationSeconds(blob: Blob): Promise<number | null> {
  let ctx: AudioContext | null = null
  try {
    ctx = new AudioContext()
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    return Number.isFinite(decoded.duration) && decoded.duration > 0 ? decoded.duration : null
  } catch {
    return null
  } finally {
    void ctx?.close()
  }
}

function disposeActivePlayers() {
  for (const { player, gain } of activePlayers) {
    try { player.unsync(); player.stop(); player.dispose() } catch { /* already disposed */ }
    try { gain.dispose() } catch { /* already disposed */ }
  }
  activePlayers = []
}
