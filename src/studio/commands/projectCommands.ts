import { registerCommand, runCommand } from "../commandBus"
import { useStudioStore } from "../engine/studioStore"
import { stopTransport } from "../engine/transportEngine"
import { audioEffectsManager } from "@/audio/AudioEffectsManager"
import { mixerEngine } from "@/audio/MixerEngine"
import { exportMix, bufferToWav, downloadBlob } from "@/audio/ExportEngine"
import { AUTOSAVE_INTERVAL_MS } from "../types/studio"
import type { SessionSnapshot } from "../types/studio"
import * as Tone from "tone"

// ── Serialisation helpers (JSON + IndexedDB for blobs) ──

const DB_NAME = "studio-core-sessions"
const STORE_NAME = "blobs"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function putBlob(key: string, blob: Blob) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getBlob(key: string): Promise<Blob | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result as Blob | undefined)
    req.onerror = () => reject(req.error)
  })
}

// ── Commands ──

registerCommand("project:new", () => {
  stopTransport()
  mixerEngine.dispose()
  audioEffectsManager.dispose()
  useStudioStore.getState().newSession()
  audioEffectsManager.init()
  mixerEngine.init()
})

registerCommand("project:open", async () => {
  const raw = localStorage.getItem("studio-core:session")
  if (!raw) { console.warn("No saved session found"); return }

  const saved: SessionSnapshot = JSON.parse(raw)
  const store = useStudioStore.getState()
  store.newSession()

  // Restore full session state
  useStudioStore.setState({
    projectId: saved.projectId ?? null,
    projectName: saved.projectName,
    bpm: saved.bpm,
    zoom: saved.zoom,
    loop: saved.loop,
    masterBus: saved.masterBus,
    tracks: saved.tracks,
    clips: saved.clips,
    mixerChannels: saved.mixerChannels ?? [],
    effects: saved.effects ?? useStudioStore.getState().effects,
    markers: saved.markers ?? [],
    snapToGrid: saved.snapToGrid ?? true,
  })

  // Restore audio blobs as object URLs
  for (const src of saved.sources ?? []) {
    const blob = await getBlob(src.id)
    const url = blob ? URL.createObjectURL(blob) : src.url
    useStudioStore.getState().addSource({ ...src, url })
  }
  console.log("Session loaded:", saved.projectName)
})

registerCommand("project:save", async () => {
  const state = useStudioStore.getState()

  // Save audio blobs to IndexedDB
  for (const src of state.sources) {
    if (src.url.startsWith("blob:")) {
      const resp = await fetch(src.url)
      const blob = await resp.blob()
      await putBlob(src.id, blob)
    }
  }

  // Save full session snapshot to localStorage
  const session: SessionSnapshot = {
    projectId: state.projectId,
    projectName: state.projectName,
    bpm: state.bpm,
    zoom: state.zoom,
    loop: state.loop,
    masterBus: state.masterBus,
    tracks: state.tracks,
    clips: state.clips,
    mixerChannels: state.mixerChannels,
    sources: state.sources.map((s) => ({ ...s, file: undefined })),
    effects: state.effects,
    markers: state.markers,
    snapToGrid: state.snapToGrid,
    savedAt: Date.now(),
  }
  localStorage.setItem("studio-core:session", JSON.stringify(session))
  console.log("Session saved:", state.projectName)
})

registerCommand("project:saveAs", () => {
  const name = prompt("Session name:", useStudioStore.getState().projectName)
  if (name) {
    useStudioStore.getState().setProjectName(name)
    runCommand("project:save")
  }
})

// ── Autosave ──

let autosaveTimer: ReturnType<typeof setInterval> | null = null

/** Start the autosave interval. Safe to call multiple times. */
export function startAutosave() {
  if (autosaveTimer) return
  autosaveTimer = setInterval(() => {
    const state = useStudioStore.getState()
    // Only autosave if there is at least one track (i.e. a real session)
    if (state.tracks.length > 0) {
      runCommand("project:save")
      console.log("Autosaved at", new Date().toLocaleTimeString())
    }
  }, AUTOSAVE_INTERVAL_MS)
}

/** Stop the autosave interval. */
export function stopAutosave() {
  if (autosaveTimer) {
    clearInterval(autosaveTimer)
    autosaveTimer = null
  }
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
