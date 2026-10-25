/**
 * Crash-safety journal for recordings in progress. While a take records, its
 * audio is appended here in ~1 s batches; on a normal stop the take is saved
 * as a WAV and the journal entry deleted. Anything left behind belongs to a
 * take that was interrupted (crash, tab closed, power loss) and can be
 * rebuilt. Uses its own database so the project database schema is untouched.
 */

const DB_NAME = "studio-core-takes"
const DB_VERSION = 1
const META_STORE = "takes"
const CHUNK_STORE = "chunks"

export interface TakeMeta {
  takeId: string
  /** Project the take belongs to ("none" if recorded without a saved session) */
  projectId: string
  trackId: string
  trackName: string
  sampleRate: number
  channelCount: number
  bpm: number
  transportStartBeat: number
  transportStartTime: number
  latencySec: number
  /** Context time of the first captured sample, once known */
  firstFrameTime: number | null
  startedAt: number
}

interface ChunkRecord {
  takeId: string
  seq: number
  frames: number
  channels: Float32Array[]
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "takeId" })
      }
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const store = db.createObjectStore(CHUNK_STORE, { keyPath: ["takeId", "seq"] })
        store.createIndex("takeId", "takeId")
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDB()
    dbPromise.catch(() => { dbPromise = null })
  }
  return dbPromise
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"))
  })
}

export async function beginTake(meta: TakeMeta): Promise<void> {
  const tx = (await db()).transaction(META_STORE, "readwrite")
  tx.objectStore(META_STORE).put(meta)
  await done(tx)
}

export async function updateTakeMeta(takeId: string, updates: Partial<TakeMeta>): Promise<void> {
  const tx = (await db()).transaction(META_STORE, "readwrite")
  const store = tx.objectStore(META_STORE)
  const req = store.get(takeId)
  req.onsuccess = () => {
    if (req.result) store.put({ ...req.result, ...updates })
  }
  await done(tx)
}

export async function appendTakeChunk(takeId: string, seq: number, channels: Float32Array[], frames: number): Promise<void> {
  const tx = (await db()).transaction(CHUNK_STORE, "readwrite")
  const record: ChunkRecord = { takeId, seq, frames, channels }
  tx.objectStore(CHUNK_STORE).put(record)
  await done(tx)
}

/** Takes left behind by an interrupted recording, oldest first. */
export async function listOrphanTakes(projectId: string): Promise<TakeMeta[]> {
  const tx = (await db()).transaction(META_STORE, "readonly")
  const req = tx.objectStore(META_STORE).getAll()
  await done(tx)
  return (req.result as TakeMeta[])
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => a.startedAt - b.startedAt)
}

/** Read a journaled take back as contiguous channel arrays. */
export async function loadTake(takeId: string): Promise<{ channels: Float32Array[]; frames: number }> {
  const tx = (await db()).transaction(CHUNK_STORE, "readonly")
  const req = tx.objectStore(CHUNK_STORE).index("takeId").getAll(takeId)
  await done(tx)
  const records = (req.result as ChunkRecord[]).sort((a, b) => a.seq - b.seq)
  const channelCount = records[0]?.channels.length ?? 1
  const frames = records.reduce((sum, r) => sum + r.frames, 0)
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames))
  let offset = 0
  for (const r of records) {
    for (let ch = 0; ch < channelCount; ch++) channels[ch].set(r.channels[ch].subarray(0, r.frames), offset)
    offset += r.frames
  }
  return { channels, frames }
}

export async function deleteTake(takeId: string): Promise<void> {
  const tx = (await db()).transaction([META_STORE, CHUNK_STORE], "readwrite")
  tx.objectStore(META_STORE).delete(takeId)
  tx.objectStore(CHUNK_STORE).delete(IDBKeyRange.bound([takeId, 0], [takeId, Infinity]))
  await done(tx)
}
