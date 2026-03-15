import * as Tone from "tone"
import { useStudioStore } from "./studioStore"
import { audioEngine } from "@/audio/AudioEngine"
import { mixerEngine } from "@/audio/MixerEngine"
import { Recorder } from "@/audio/Recorder"

// ── Internal state ──
let animationFrame: number | null = null
let lastTime = 0
let activePlayers: Tone.Player[] = []
const recorder = new Recorder()
let micStream: MediaStream | null = null

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
    if (channel) {
      player.connect(channel)
    } else {
      player.toDestination()
    }

    const startSec = clip.start / (store.bpm / 60)
    player.sync().start(startSec)
    activePlayers.push(player)

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

  Tone.getTransport().start(undefined, `${store.playhead / (store.bpm / 60)}`)

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

// ── Recording (dry) ──

export async function recordTransport() {
  const state = useStudioStore.getState()

  // Ensure there is an armed track
  const armedTrack = state.tracks.find((t) => t.armed)
  if (!armedTrack) {
    console.warn("No track armed for recording")
    return
  }

  // Get microphone (dry path — no FX on capture)
  if (!micStream) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      console.warn("Microphone access denied")
      return
    }
  }

  recorder.start(micStream)

  if (!state.isPlaying) {
    await playTransport()
  }
  useStudioStore.getState().setRecording(true)
}

export async function stopRecording() {
  const state = useStudioStore.getState()
  if (!state.isRecording) return

  useStudioStore.getState().setRecording(false)

  const blob = await recorder.stop()
  if (blob.size === 0) return

  const url = URL.createObjectURL(blob)

  // Calculate duration in beats
  const audio = new Audio()
  audio.src = url
  await new Promise<void>((resolve) => {
    audio.addEventListener("loadedmetadata", () => resolve(), { once: true })
  })
  const durationSeconds = audio.duration
  const durationBeats = durationSeconds * (state.bpm / 60)

  const armedTrack = state.tracks.find((t) => t.armed)
  if (!armedTrack) return

  // Push undo before creating clip
  useStudioStore.getState().pushUndo()

  // Create source (dry recording)
  const sourceId = useStudioStore.getState().addSource({
    name: `Recording ${state.sources.length + 1}`,
    url,
    duration: durationSeconds,
  })

  // Create clip on the armed track at the position recording started
  const recordStartBeat = Math.max(0, state.playhead - durationBeats)
  useStudioStore.getState().addClip({
    trackId: armedTrack.id,
    sourceId,
    start: recordStartBeat,
    end: recordStartBeat + durationBeats,
    offset: 0,
    name: armedTrack.name,
    color: armedTrack.color,
  })
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

function disposeActivePlayers() {
  for (const p of activePlayers) {
    try { p.unsync(); p.stop(); p.dispose() } catch { /* already disposed */ }
  }
  activePlayers = []
}
