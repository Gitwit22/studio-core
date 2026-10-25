import { registerCommand, runCommand } from "../commandBus"
import { useStudioStore } from "../engine/studioStore"
import { stopTransport } from "../engine/transportEngine"
import { audioEffectsManager } from "@/audio/AudioEffectsManager"
import { mixerEngine, computeEffectiveMutes, linearToDb } from "@/audio/MixerEngine"
import {
  exportMix,
  bufferToWav,
  downloadBlob,
  normalizeBuffer,
  type WavBitDepth,
} from "@/audio/ExportEngine"
import type { StudioState } from "../types/studio"
import { persistenceService } from "../persistence"
import * as Tone from "tone"
import { toast } from "sonner"

// ── Commands ──

registerCommand("project:new", () => {
  // Route through the session dialog so the new session gets its own project
  // handle. Resetting the store in place kept the previous project's handle,
  // so the next save overwrote that project with the blank session.
  stopTransport()
  useStudioStore.getState().setActiveModal("newSession")
})

registerCommand("project:open", async () => {
  // Opening is now handled by the NewSessionDialog "Recent" tab
  // which calls persistenceService.openSession()
  // This command is kept for backward compatibility / keyboard shortcut
  console.log("Use File > Open from the session dialog to open a project")
})

registerCommand("project:save", async () => {
  if (!persistenceService.currentHandle) {
    toast.error("No open session to save")
    return
  }
  try {
    await persistenceService.save()
    toast.success("Session saved")
  } catch (err) {
    console.warn("Save failed:", err)
    toast.error("Save failed", { description: err instanceof Error ? err.message : undefined })
  }
})

registerCommand("project:saveAs", () => {
  useStudioStore.getState().setActiveModal("saveSessionAs")
})

// ── Autosave ──

/** Start the autosave interval. Safe to call multiple times. */
export function startAutosave() {
  persistenceService.startAutosave()
}

/** Stop the autosave interval. */
export function stopAutosave() {
  persistenceService.stopAutosave()
}

export interface ExportOptions {
  fileName?: string
  bitDepth?: WavBitDepth
  /** Output sample rate; defaults to the audio engine's rate */
  sampleRate?: number
  /** Peak-normalize each rendered file to -0.1 dBFS */
  normalize?: boolean
  /** Seconds of silence after the last clip (lets reverb/delay tails ring out) */
  tailSeconds?: number
  /** One file per track instead of the master mix */
  perTrack?: boolean
}

/**
 * Render offline and download as WAV.
 * Mirrors live playback: clip offset/length/rate/gain/fades, track volume/pan,
 * mute/solo, bus routing, master volume and master limiter. Per-track and
 * master FX are not rendered yet.
 *
 * Per-track files are the track's clips through its own volume/pan only
 * (pre-bus, pre-master, ignoring mute/solo) so each file is usable on its own.
 */
export async function exportProjectMix(options: ExportOptions = {}): Promise<void> {
  const state = useStudioStore.getState()
  const baseName = (options.fileName || state.projectName).trim() || "mix"
  const beatsPerSec = state.bpm / 60
  const maxBeat = state.clips.reduce((max, c) => Math.max(max, c.end), 8)
  const durationSec = maxBeat / beatsPerSec + (options.tailSeconds ?? 0)

  if (!options.perTrack) {
    const buffer = await exportMix(durationSec, () => buildExportGraph(state, beatsPerSec), options.sampleRate)
    downloadBlob(await finishExport(buffer, options), `${baseName}.wav`)
    return
  }

  const tracksWithAudio = state.tracks.filter((t) =>
    state.clips.some((c) => c.trackId === t.id && state.sources.some((s) => s.id === c.sourceId && s.url)),
  )
  if (tracksWithAudio.length === 0) throw new Error("No tracks with audio to export")
  for (const track of tracksWithAudio) {
    const buffer = await exportMix(durationSec, () => buildExportGraph(state, beatsPerSec, track.id), options.sampleRate)
    downloadBlob(await finishExport(buffer, options), `${baseName} - ${track.name}.wav`)
  }
}

async function finishExport(rendered: Tone.ToneAudioBuffer, options: ExportOptions): Promise<Blob> {
  const audio = rendered.get()
  if (!audio) throw new Error("Render produced no audio")
  if (options.normalize) normalizeBuffer(audio)
  return bufferToWav(audio, options.bitDepth ?? 16)
}

/** Build the offline graph. With `onlyTrackId`, render that track alone straight to the output. */
async function buildExportGraph(state: StudioState, beatsPerSec: number, onlyTrackId?: string) {
  const muted = computeEffectiveMutes(state.tracks, state.mixerChannels)
  const tracks = onlyTrackId ? state.tracks.filter((t) => t.id === onlyTrackId) : state.tracks

  // Same master chain as live playback: master gain → limiter (-1 dB)
  const master = onlyTrackId
    ? null
    : new Tone.Gain(state.masterBus.volume / 100).connect(new Tone.Limiter(-1).toDestination())

  const channels = new Map<string, Tone.Channel>()
  for (const track of tracks) {
    const ch = state.mixerChannels.find((c) => c.id === track.channelId)
    channels.set(track.id, new Tone.Channel({
      volume: linearToDb(ch?.volume ?? track.volume),
      pan: ch?.pan ?? track.pan,
      mute: onlyTrackId ? false : (muted.get(track.id) ?? false),
    }))
  }
  for (const track of tracks) {
    const channel = channels.get(track.id)!
    const bus = track.busId ? channels.get(track.busId) : undefined
    if (bus) channel.connect(bus)
    else if (master) channel.connect(master)
    else channel.toDestination()
  }

  // Decode each source once (in the offline context, at its sample rate) before
  // scheduling: starting a Player whose buffer is still loading throws.
  const buffers = new Map<string, Tone.ToneAudioBuffer>()
  for (const clip of state.clips) {
    const src = state.sources.find((s) => s.id === clip.sourceId)
    if (!src?.url || !channels.has(clip.trackId) || buffers.has(src.id)) continue
    buffers.set(src.id, await new Tone.ToneAudioBuffer().load(src.url))
  }

  for (const clip of state.clips) {
    const buffer = buffers.get(clip.sourceId)
    const channel = channels.get(clip.trackId)
    if (!buffer || !channel) continue
    const player = new Tone.Player(buffer)
    const clipGain = new Tone.Gain(clip.gain ?? 1)
    player.connect(clipGain)
    clipGain.connect(channel)
    player.playbackRate = clip.playbackRate ?? 1
    if ((clip.fadeInDuration ?? 0) > 0) player.fadeIn = clip.fadeInDuration / beatsPerSec
    if ((clip.fadeOutDuration ?? 0) > 0) player.fadeOut = clip.fadeOutDuration / beatsPerSec
    player.sync().start(
      clip.start / beatsPerSec,
      (clip.offset ?? 0) / beatsPerSec,
      (clip.end - clip.start) / beatsPerSec,
    )
  }
  Tone.getTransport().start()
}

registerCommand("project:export", async () => {
  try {
    await exportProjectMix()
    toast.success("Mix exported")
  } catch (err) {
    console.warn("Export failed:", err)
    toast.error("Export failed", { description: err instanceof Error ? err.message : undefined })
  }
})

// Session commands (open modals)
registerCommand("session:new", () => {
  stopTransport()
  useStudioStore.getState().setActiveModal("newSession");
});

registerCommand("session:open", () => {
  stopTransport()
  useStudioStore.getState().setActiveModal("openSession");
});

registerCommand("session:saveAs", () => {
  useStudioStore.getState().setActiveModal("saveSessionAs");
});

registerCommand("session:info", () => {
  useStudioStore.getState().setActiveModal("sessionInfo");
});

/** Close the session without saving and return to the landing page. */
export function closeSession() {
  stopTransport()
  mixerEngine.dispose()
  audioEffectsManager.dispose()
  persistenceService.stopAutosave()
  // reset() clears the dirty flag, so leaving does not trigger the unload warning
  useStudioStore.getState().reset()
  window.location.href = "/"
}

registerCommand("session:close", () => {
  if (persistenceService.currentHandle && useStudioStore.getState().isDirty) {
    useStudioStore.getState().setActiveModal("unsavedChanges")
    return
  }
  closeSession()
});

/** Rebuild the master bus and mixer graph (e.g. after an audio device glitch). */
export function resetAudioEngine() {
  stopTransport()
  mixerEngine.dispose()
  audioEffectsManager.dispose()
  audioEffectsManager.init()
  mixerEngine.init()
}

registerCommand("session:recent", () => {
  stopTransport()
  useStudioStore.getState().setActiveModal("openSession");
});

// File commands
registerCommand("file:importAudio", () => {
  window.dispatchEvent(new CustomEvent("studio:import-audio"));
});

registerCommand("file:exportMix", () => {
  useStudioStore.getState().setActiveModal("exportMix");
});
