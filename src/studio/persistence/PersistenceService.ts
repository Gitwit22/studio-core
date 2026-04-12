import type {
  StorageAdapter,
  ProjectHandle,
  NewSessionConfig,
  ProjectRef,
} from "./types"
import { supportsFileSystemAccess } from "./types"
import { FileSystemAdapter } from "./FileSystemAdapter"
import { IndexedDbAdapter } from "./IndexedDbAdapter"
import { recentSessions } from "./RecentSessions"
import { storeHandle, retrieveHandle } from "./handleStore"
import { useStudioStore } from "../engine/studioStore"
import type { SessionSnapshot } from "../types/studio"
import { AUTOSAVE_INTERVAL_MS } from "../types/studio"

/**
 * Singleton service that sits between the store and storage adapters.
 * Handles creating, opening, saving sessions, dirty tracking, and autosave.
 */
class PersistenceService {
  private adapter: StorageAdapter | null = null
  private handle: ProjectHandle | null = null
  private autosaveTimer: ReturnType<typeof setInterval> | null = null
  private _isDirty = false

  // ── Getters ──

  get currentHandle() { return this.handle }
  get isDirty() { return this._isDirty }
  get isFileSystem() { return this.adapter?.type === "filesystem" }

  // ── Dirty tracking ──

  markDirty() {
    this._isDirty = true
  }

  clearDirty() {
    this._isDirty = false
  }

  // ── Adapter selection ──

  private pickAdapter(useFileSystem: boolean): StorageAdapter {
    if (useFileSystem && supportsFileSystemAccess()) {
      return new FileSystemAdapter()
    }
    return new IndexedDbAdapter()
  }

  // ── Session lifecycle ──

  async createSession(config: NewSessionConfig): Promise<void> {
    const adapter = this.pickAdapter(config.useFileSystem)
    this.adapter = adapter

    const handle = await adapter.createProject(config.name, config.parentDirHandle)
    this.handle = handle

    // Reset store with new session
    const store = useStudioStore.getState()
    store.newSession()
    useStudioStore.setState({
      projectId: handle.id,
      projectName: config.name,
      bpm: config.bpm,
    })

    // Persist the directory handle so re-opening skips the picker
    if (handle.dirHandle) {
      await storeHandle(handle.id, handle.dirHandle)
    }

    // Do initial save
    await this.save()

    // Register in recents
    await recentSessions.add({
      id: handle.id,
      name: config.name,
      path: adapter.type === "filesystem" ? handle.name : "Browser Storage",
      lastOpenedAt: Date.now(),
      adapterType: adapter.type,
    })

    this.startAutosave()
  }

  async openSession(ref: ProjectRef): Promise<void> {
    const adapter = this.pickAdapter(ref.adapterType === "filesystem")
    this.adapter = adapter

    let handle: ProjectHandle

    if (ref.adapterType === "filesystem") {
      // Try to reuse the stored directory handle (avoids showing a picker)
      let dirHandle: FileSystemDirectoryHandle | null = null
      try {
        dirHandle = await retrieveHandle(ref.id)
        if (dirHandle) {
          // Verify we still have permission (browser may have revoked it)
          const perm = await dirHandle.requestPermission({ mode: "readwrite" })
          if (perm !== "granted") dirHandle = null
        }
      } catch {
        dirHandle = null
      }

      // Fallback: ask user to pick the folder
      if (!dirHandle) {
        dirHandle = await window.showDirectoryPicker({ mode: "readwrite" })
        await storeHandle(ref.id, dirHandle)
      }

      handle = { id: ref.id, name: ref.name, adapterType: "filesystem", dirHandle }
    } else {
      handle = { id: ref.id, name: ref.name, adapterType: "indexeddb" }
    }

    this.handle = handle

    const snapshot = await adapter.openProject(handle)
    this.restoreSnapshot(snapshot)

    // Restore audio blob URLs
    for (const src of snapshot.sources ?? []) {
      if (src.url && !src.url.startsWith("blob:")) {
        // url contains relative path like "audio/recording-1.wav"
        const relPath = src.url
        try {
          const blobUrl = await adapter.loadAudioFile(handle, relPath)
          // Update the source with a real blob: URL and preserve relativePath
          useStudioStore.setState((state) => ({
            sources: state.sources.map((s) =>
              s.id === src.id ? { ...s, url: blobUrl, relativePath: relPath } : s,
            ),
          }))
        } catch {
          console.warn(`Could not load audio file: ${relPath}`)
        }
      }
    }

    await recentSessions.touch(ref.id)
    this.clearDirty()
    this.startAutosave()
  }

  async save(): Promise<void> {
    if (!this.adapter || !this.handle) {
      console.warn("No active project to save")
      return
    }

    const snapshot = this.buildSnapshot()
    await this.adapter.saveSession(this.handle, snapshot)
    this.clearDirty()
    console.log("Session saved:", this.handle.name)
  }

  async saveAs(name: string): Promise<void> {
    if (!this.adapter || !this.handle) return

    useStudioStore.getState().setProjectName(name)
    this.handle = { ...this.handle, name }
    await this.save()
    await recentSessions.touch(this.handle.id)
  }

  /** Save an audio file into the project's audio/ folder */
  async saveAudio(filename: string, blob: Blob): Promise<string> {
    if (!this.adapter || !this.handle) {
      // Fallback: return blob URL if no project open
      return URL.createObjectURL(blob)
    }
    return this.adapter.saveAudioFile(this.handle, filename, blob)
  }

  /** Load an audio file from the project and return a blob URL */
  async loadAudio(relativePath: string): Promise<string> {
    if (!this.adapter || !this.handle) {
      throw new Error("No active project")
    }
    return this.adapter.loadAudioFile(this.handle, relativePath)
  }

  // ── Autosave ──

  startAutosave() {
    this.stopAutosave()
    this.autosaveTimer = setInterval(async () => {
      if (!this._isDirty || !this.adapter || !this.handle) return
      try {
        const snapshot = this.buildSnapshot()
        await this.adapter.saveAutosaveBackup(this.handle, snapshot)
        await this.adapter.saveSession(this.handle, snapshot)
        this.clearDirty()
        console.log("Autosaved at", new Date().toLocaleTimeString())
      } catch (err) {
        console.warn("Autosave failed:", err)
      }
    }, AUTOSAVE_INTERVAL_MS)
  }

  stopAutosave() {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer)
      this.autosaveTimer = null
    }
  }

  /** Immediate save if dirty (call after significant actions) */
  async immediateSaveIfDirty(): Promise<void> {
    if (!this._isDirty || !this.adapter || !this.handle) return
    try {
      await this.save()
    } catch (err) {
      console.warn("Immediate save failed:", err)
    }
  }

  // ── Snapshot helpers ──

  private buildSnapshot(): SessionSnapshot {
    const state = useStudioStore.getState()
    return {
      projectId: state.projectId,
      projectName: state.projectName,
      bpm: state.bpm,
      zoom: state.zoom,
      loop: state.loop,
      masterBus: state.masterBus,
      tracks: state.tracks,
      clips: state.clips,
      mixerChannels: state.mixerChannels,
      sources: state.sources.map((s) => ({
        ...s,
        file: undefined,
        // Persist the relative path as the url so it survives reload
        url: s.relativePath || s.url,
      })),
      effects: state.effects,
      markers: state.markers,
      snapToGrid: state.snapToGrid,
      savedAt: Date.now(),
    }
  }

  private restoreSnapshot(saved: SessionSnapshot) {
    const store = useStudioStore.getState()
    store.newSession()
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
      sources: saved.sources?.map((s) => ({ ...s, file: undefined })) ?? [],
    })
  }
}

/** Singleton instance */
export const persistenceService = new PersistenceService()
