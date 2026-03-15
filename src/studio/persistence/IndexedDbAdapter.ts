import type { StorageAdapter, ProjectHandle } from "./types"
import {
  SESSION_FILENAME,
  AUTOSAVE_PREFIX,
  MAX_AUTOSAVE_BACKUPS,
} from "./types"
import type { SessionSnapshot } from "../types/studio"

const DB_NAME = "studio-core-projects"
const DB_VERSION = 2
const SESSIONS_STORE = "sessions"    // session.json per project
const AUDIO_STORE = "audio-files"    // audio blobs keyed by projectId/filename

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE)
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function putValue(store: string, key: string, value: unknown) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    tx.objectStore(store).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getValue<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly")
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

/**
 * StorageAdapter backed by IndexedDB.
 * Used as a fallback when the File System Access API is unavailable
 * (e.g. Firefox, some mobile browsers).
 *
 * Session JSON is stored in the "sessions" store keyed by project id.
 * Audio blobs are stored in the "audio-files" store keyed by "projectId/filename".
 */
export class IndexedDbAdapter implements StorageAdapter {
  readonly type = "indexeddb" as const

  async createProject(name: string): Promise<ProjectHandle> {
    const id = crypto.randomUUID()
    const initial: Partial<SessionSnapshot> = {
      projectId: id,
      projectName: name,
      savedAt: Date.now(),
    }
    await putValue(SESSIONS_STORE, id, JSON.stringify(initial))
    return { id, name, adapterType: "indexeddb" }
  }

  async openProject(handle: ProjectHandle): Promise<SessionSnapshot> {
    const raw = await getValue<string>(SESSIONS_STORE, handle.id)
    if (!raw) throw new Error(`Project ${handle.id} not found in IndexedDB`)
    return JSON.parse(raw) as SessionSnapshot
  }

  async saveSession(handle: ProjectHandle, snapshot: SessionSnapshot): Promise<void> {
    await putValue(SESSIONS_STORE, handle.id, JSON.stringify(snapshot))
  }

  async saveAudioFile(
    handle: ProjectHandle,
    filename: string,
    blob: Blob,
  ): Promise<string> {
    const key = `${handle.id}/audio/${filename}`
    await putValue(AUDIO_STORE, key, blob)
    return `audio/${filename}`
  }

  async loadAudioFile(handle: ProjectHandle, relativePath: string): Promise<string> {
    const key = `${handle.id}/${relativePath}`
    const blob = await getValue<Blob>(AUDIO_STORE, key)
    if (!blob) throw new Error(`Audio file not found: ${key}`)
    return URL.createObjectURL(blob)
  }

  async saveAutosaveBackup(handle: ProjectHandle, snapshot: SessionSnapshot): Promise<void> {
    // Rotate backups
    for (let i = MAX_AUTOSAVE_BACKUPS - 1; i >= 1; i--) {
      const srcKey = i === 1
        ? `${handle.id}/${AUTOSAVE_PREFIX}`
        : `${handle.id}/${AUTOSAVE_PREFIX}.${i - 1}`
      const destKey = `${handle.id}/${AUTOSAVE_PREFIX}.${i}`
      const existing = await getValue<string>(SESSIONS_STORE, srcKey)
      if (existing) {
        await putValue(SESSIONS_STORE, destKey, existing)
      }
    }
    await putValue(SESSIONS_STORE, `${handle.id}/${AUTOSAVE_PREFIX}`, JSON.stringify(snapshot))
  }
}
