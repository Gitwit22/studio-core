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

/** Max time the app waits for cloud hydration before rendering anyway. */
const CLOUD_HYDRATE_TIMEOUT_MS = 5_000

/**
 * Store fields that are written into a SessionSnapshot. Used to decide whether
 * the store changed while an async save was in flight (in which case the
 * dirty flag must stay set so the newer edits are saved on the next pass).
 */
const PERSISTED_KEYS = [
  "projectId",
  "projectName",
  "bpm",
  "loop",
  "masterBus",
  "tracks",
  "clips",
  "mixerChannels",
  "sources",
  "effects",
  "markers",
  "snapToGrid",
] as const satisfies readonly (keyof StudioState)[]
import { useStudioStore } from "../engine/studioStore"
import { toast } from "sonner"
import {
  AUTOSAVE_INTERVAL_MS,
  clipDefaults,
  type SessionSnapshot,
  type StudioState,
} from "../types/studio"
import {
  canHydrateFromCloud,
  fetchStudioState,
  getStudioApiBaseUrl,
  getStudioWorkspaceId,
  pushStudioState,
  stableSnapshotHash,
} from "./cloudStateSync"

/**
 * Singleton service that sits between the store and storage adapters.
 * Handles creating, opening, saving sessions, dirty tracking, and autosave.
 */
class PersistenceService {
  private adapter: StorageAdapter | null = null
  private handle: ProjectHandle | null = null
  private autosaveTimer: ReturnType<typeof setInterval> | null = null
  private lastRemoteHash = ""

  // ── Getters ──

  get currentHandle() { return this.handle }
  /** The store's isDirty flag is the single source of truth (every edit action sets it). */
  get isDirty() { return useStudioStore.getState().isDirty }
  get isFileSystem() { return this.adapter?.type === "filesystem" }

  // ── Dirty tracking ──

  markDirty() {
    useStudioStore.getState().markDirty()
  }

  clearDirty() {
    useStudioStore.getState().clearDirty()
  }

  /** Clear dirty only if no persisted field changed since `savedFrom` was read. */
  private clearDirtyIfUnchanged(savedFrom: StudioState) {
    const current = useStudioStore.getState()
    if (PERSISTED_KEYS.every((key) => current[key] === savedFrom[key])) {
      this.clearDirty()
    }
  }

  /**
   * Before switching projects, persist unsaved work in the current one.
   * Throws if that save fails so the caller does not discard the edits.
   */
  private async flushBeforeSwitch(): Promise<void> {
    if (this.isDirty && this.adapter && this.handle) {
      await this.save()
    }
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
    await this.flushBeforeSwitch()
    // Stop autosave while switching so it can never write the new store state
    // into the previous project (or the old state into the new one).
    this.stopAutosave()
    try {
      await this.createSessionInner(config)
    } finally {
      if (this.handle) this.startAutosave()
    }
  }

  private async createSessionInner(config: NewSessionConfig): Promise<void> {
    const adapter = this.pickAdapter(config.useFileSystem)
    const handle = await adapter.createProject(config.name, config.parentDirHandle)
    this.adapter = adapter
    this.handle = handle

    // Reset store with new session
    const store = useStudioStore.getState()
    store.newSession()
    useStudioStore.setState({
      projectId: handle.id,
      // handle.name may differ from config.name if a folder with that name already existed
      projectName: handle.name,
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
      name: handle.name,
      path: adapter.type === "filesystem" ? handle.name : "Browser Storage",
      lastOpenedAt: Date.now(),
      adapterType: adapter.type,
    })
  }

  async openSession(ref: ProjectRef): Promise<void> {
    await this.flushBeforeSwitch()
    this.stopAutosave()
    try {
      await this.openSessionInner(ref)
    } finally {
      if (this.handle) this.startAutosave()
    }
  }

  private async openSessionInner(ref: ProjectRef): Promise<void> {
    const adapter = this.pickAdapter(ref.adapterType === "filesystem")

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

    // Read the project before switching the active handle: if this fails, the
    // previous project stays active and is not overwritten by later saves.
    const snapshot = await adapter.openProject(handle)
    this.adapter = adapter
    this.handle = handle
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
    this.lastRemoteHash = stableSnapshotHash(this.buildSnapshot())
  }

  async hydrateFromCloud(): Promise<boolean> {
    const context = this.getCloudContext()
    if (!context) {
      return false
    }

    const state = useStudioStore.getState()
    const alreadyHasLocalState = Boolean(state.projectId)
      || state.tracks.length > 0
      || state.clips.length > 0
      || state.sources.length > 0

    if (alreadyHasLocalState) {
      return false
    }

    // Bootstrap awaits this before rendering, so never let a slow API block the app.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CLOUD_HYDRATE_TIMEOUT_MS)
    try {
      const remote = await fetchStudioState(context.apiBaseUrl, context.workspaceId, controller.signal)
      if (!remote?.state || !canHydrateFromCloud(remote.state)) {
        return false
      }

      this.restoreSnapshot(remote.state)
      this.lastRemoteHash = stableSnapshotHash(remote.state)
      this.clearDirty()
      return true
    } catch (error) {
      console.warn("Cloud hydration failed:", error)
      return false
    } finally {
      clearTimeout(timeout)
    }
  }

  async save(): Promise<void> {
    if (!this.adapter || !this.handle) {
      console.warn("No active project to save")
      return
    }

    const state = useStudioStore.getState()
    const snapshot = this.buildSnapshot(state)
    await this.adapter.saveSession(this.handle, snapshot)
    this.clearDirtyIfUnchanged(state)
    void this.syncToCloud(snapshot)
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
    // Imports keep their original file name, so two files called e.g. "vocal.wav"
    // would otherwise overwrite each other in the project's audio/ folder.
    return this.adapter.saveAudioFile(this.handle, uniqueAudioFilename(filename), blob)
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
      if (!this.isDirty || !this.adapter || !this.handle) return
      try {
        const state = useStudioStore.getState()
        const snapshot = this.buildSnapshot(state)
        await this.adapter.saveAutosaveBackup(this.handle, snapshot)
        await this.adapter.saveSession(this.handle, snapshot)
        this.clearDirtyIfUnchanged(state)
        void this.syncToCloud(snapshot)
        console.log("Autosaved at", new Date().toLocaleTimeString())
      } catch (err) {
        console.warn("Autosave failed:", err)
        // Fixed id: repeated failures update one toast instead of stacking.
        toast.error("Autosave failed — your latest changes are not saved yet.", {
          id: "autosave-failed",
          description: err instanceof Error ? err.message : undefined,
        })
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
    if (!this.isDirty || !this.adapter || !this.handle) return
    try {
      await this.save()
    } catch (err) {
      console.warn("Immediate save failed:", err)
    }
  }

  // ── Snapshot helpers ──

  private buildSnapshot(state: StudioState = useStudioStore.getState()): SessionSnapshot {
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
      // Sessions saved before clip gain/fades/rate existed lack those fields;
      // fill defaults so edits like split don't compute NaN offsets.
      clips: (saved.clips ?? []).map((c) => ({ ...clipDefaults, ...c })),
      mixerChannels: saved.mixerChannels ?? [],
      effects: saved.effects ?? useStudioStore.getState().effects,
      markers: saved.markers ?? [],
      snapToGrid: saved.snapToGrid ?? true,
      sources: saved.sources?.map((s) => ({ ...s, file: undefined })) ?? [],
    })
  }

  private getCloudContext(): { apiBaseUrl: string; workspaceId: string } | null {
    const apiBaseUrl = getStudioApiBaseUrl()
    if (!apiBaseUrl) {
      return null
    }

    return {
      apiBaseUrl,
      workspaceId: getStudioWorkspaceId(),
    }
  }

  private async syncToCloud(snapshot: SessionSnapshot): Promise<void> {
    const context = this.getCloudContext()
    if (!context) {
      return
    }

    const nextHash = stableSnapshotHash(snapshot)
    if (nextHash === this.lastRemoteHash) {
      return
    }

    try {
      await pushStudioState(context.apiBaseUrl, context.workspaceId, snapshot)
      this.lastRemoteHash = nextHash
    } catch (error) {
      console.warn("Cloud sync failed:", error)
    }
  }
}

function uniqueAudioFilename(original: string): string {
  const safe = original.replace(/[\\/:*?"<>|]/g, "_").trim() || "audio"
  return `${crypto.randomUUID().slice(0, 8)}-${safe}`
}

/** Singleton instance */
export const persistenceService = new PersistenceService()
