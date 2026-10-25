import { registerCommand, runCommand } from "../commandBus"
import { useStudioStore } from "../engine/studioStore"
import { stopTransport } from "../engine/transportEngine"
import { audioEffectsManager } from "@/audio/AudioEffectsManager"
import { mixerEngine, computeEffectiveMutes, linearToDb } from "@/audio/MixerEngine"
import { exportMix, bufferToWav, downloadBlob } from "@/audio/ExportEngine"
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
  const name = prompt("Session name:", useStudioStore.getState().projectName)
  if (name) {
    persistenceService.saveAs(name)
  }
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

/**
 * Render the arrangement offline and download it as a 16-bit WAV.
 * Mirrors live playback: clip offset/length/rate/gain/fades, track volume/pan,
 * mute/solo, bus routing and master volume. Per-track and master FX are not
 * rendered yet.
 */
export async function exportProjectMix(fileName?: string): Promise<void> {
  const state = useStudioStore.getState()
  const beatsPerSec = state.bpm / 60
  const maxBeat = state.clips.reduce((max, c) => Math.max(max, c.end), 8)
  const durationSec = maxBeat / beatsPerSec
  const muted = computeEffectiveMutes(state.tracks, state.mixerChannels)

  const buffer = await exportMix(durationSec, () => {
    const master = new Tone.Gain(state.masterBus.volume / 100).toDestination()

    const channels = new Map<string, Tone.Channel>()
    for (const track of state.tracks) {
      const ch = state.mixerChannels.find((c) => c.id === track.channelId)
      channels.set(track.id, new Tone.Channel({
        volume: linearToDb(ch?.volume ?? track.volume),
        pan: ch?.pan ?? track.pan,
        mute: muted.get(track.id) ?? false,
      }))
    }
    for (const track of state.tracks) {
      const out = (track.busId && channels.get(track.busId)) || master
      channels.get(track.id)!.connect(out)
    }

    for (const clip of state.clips) {
      const src = state.sources.find((s) => s.id === clip.sourceId)
      const channel = channels.get(clip.trackId)
      if (!src?.url || !channel) continue
      const player = new Tone.Player(src.url)
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
  })

  const wav = bufferToWav(buffer)
  downloadBlob(wav, `${(fileName || state.projectName).trim() || "mix"}.wav`)
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

registerCommand("session:close", () => {
  stopTransport()
  mixerEngine.dispose()
  audioEffectsManager.dispose()
  persistenceService.stopAutosave()
  useStudioStore.getState().reset()
  window.location.href = "/"
});

registerCommand("session:recent", () => {
  console.log("Recent sessions");
});

// File commands
registerCommand("file:importAudio", () => {
  window.dispatchEvent(new CustomEvent("studio:import-audio"));
});

registerCommand("file:exportMix", () => {
  useStudioStore.getState().setActiveModal("exportMix");
});
