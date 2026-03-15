import { registerCommand, runCommand } from "../commandBus"
import { useStudioStore } from "../engine/studioStore"
import { stopTransport } from "../engine/transportEngine"
import { audioEffectsManager } from "@/audio/AudioEffectsManager"
import { mixerEngine } from "@/audio/MixerEngine"
import { exportMix, bufferToWav, downloadBlob } from "@/audio/ExportEngine"
import { persistenceService } from "../persistence"
import * as Tone from "tone"

// ── Commands ──

registerCommand("project:new", () => {
  stopTransport()
  mixerEngine.dispose()
  audioEffectsManager.dispose()
  // New session creation is now handled by the NewSessionDialog
  // which calls persistenceService.createSession()
  useStudioStore.getState().newSession()
  audioEffectsManager.init()
  mixerEngine.init()
})

registerCommand("project:open", async () => {
  // Opening is now handled by the NewSessionDialog "Recent" tab
  // which calls persistenceService.openSession()
  // This command is kept for backward compatibility / keyboard shortcut
  console.log("Use File > Open from the session dialog to open a project")
})

registerCommand("project:save", async () => {
  try {
    await persistenceService.save()
  } catch (err) {
    console.warn("Save failed:", err)
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

registerCommand("project:export", async () => {
  const state = useStudioStore.getState()
  const maxBeat = Math.max(...state.clips.map((c) => c.end), 8)
  const durationSec = maxBeat / (state.bpm / 60)

  const buffer = await exportMix(durationSec, () => {
    // Build offline graph
    for (const clip of state.clips) {
      const src = state.sources.find((s) => s.id === clip.sourceId)
      if (!src?.url) continue
      const player = new Tone.Player(src.url).toDestination()
      player.sync().start(clip.start / (state.bpm / 60))
    }
    Tone.getTransport().start()
  })

  const wav = bufferToWav(buffer)
  downloadBlob(wav, `${state.projectName}.wav`)
})

// Session commands (open modals)
registerCommand("session:new", () => {
  useStudioStore.getState().setActiveModal("newSession");
});

registerCommand("session:open", () => {
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
