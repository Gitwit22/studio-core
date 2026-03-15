import { registerCommand } from "../commandBus"
import { useStudioStore } from "../engine/studioStore"
import { stopTransport } from "../engine/transportEngine"
import { audioEffectsManager } from "@/audio/AudioEffectsManager"
import { exportMix, bufferToWav, downloadBlob } from "@/audio/ExportEngine"
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
  audioEffectsManager.dispose()
  useStudioStore.getState().newSession()
})

registerCommand("project:open", async () => {
  const raw = localStorage.getItem("studio-core:session")
  if (!raw) { console.warn("No saved session found"); return }

  const saved = JSON.parse(raw)
  const store = useStudioStore.getState()
  store.newSession()

  // Restore metadata
  useStudioStore.setState({
    projectName: saved.projectName,
    bpm: saved.bpm,
    zoom: saved.zoom,
    loop: saved.loop,
    effects: saved.effects,
    tracks: saved.tracks,
    clips: saved.clips,
  })

  // Restore audio blobs as object URLs
  for (const src of saved.sources ?? []) {
    const blob = await getBlob(src.id)
    const url = blob ? URL.createObjectURL(blob) : src.url
    useStudioStore.getState().addSource({ ...src, url })
  }
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

  // Save JSON metadata to localStorage
  const session = {
    projectName: state.projectName,
    bpm: state.bpm,
    zoom: state.zoom,
    loop: state.loop,
    effects: state.effects,
    tracks: state.tracks,
    clips: state.clips,
    sources: state.sources.map((s) => ({ ...s, file: undefined })),
  }
  localStorage.setItem("studio-core:session", JSON.stringify(session))
  console.log("Session saved")
})

registerCommand("project:saveAs", () => {
  const name = prompt("Session name:", useStudioStore.getState().projectName)
  if (name) {
    useStudioStore.getState().setProjectName(name)
    runSave()
  }
})

function runSave() {
  // Reuse the save command
  const commands = (globalThis as any).__studioBusSaveHook
  if (commands) commands()
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
