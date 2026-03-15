import type { ProjectRef } from "./types"

const DB_NAME = "studio-core-recents"
const STORE_NAME = "recent-sessions"
const DB_VERSION = 1
const MAX_RECENTS = 20

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

class RecentSessionsRegistry {
  /** Return all recent sessions, sorted newest-first */
  async list(): Promise<ProjectRef[]> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => {
        const items = (req.result as ProjectRef[]).sort(
          (a, b) => b.lastOpenedAt - a.lastOpenedAt,
        )
        resolve(items.slice(0, MAX_RECENTS))
      }
      req.onerror = () => reject(req.error)
    })
  }

  /** Add or overwrite a recent session entry */
  async add(ref: ProjectRef): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).put(ref)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /** Update lastOpenedAt for a session */
  async touch(id: string): Promise<void> {
    const all = await this.list()
    const existing = all.find((r) => r.id === id)
    if (existing) {
      await this.add({ ...existing, lastOpenedAt: Date.now() })
    }
  }

  /** Remove a session from recents */
  async remove(id: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}

export const recentSessions = new RecentSessionsRegistry()
