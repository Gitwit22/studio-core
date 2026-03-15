import type { SessionSnapshot } from "../types/studio"

// ── Project reference (stored in recent-sessions registry) ──

export interface ProjectRef {
  id: string
  name: string
  path: string              // display label: folder path or "Browser Storage"
  lastOpenedAt: number      // Date.now()
  adapterType: "filesystem" | "indexeddb"
  /** Serialised FileSystemDirectoryHandle for re-requesting permission */
  fsHandleKey?: string
}

// ── Project handle (runtime reference to an open project) ──

export interface ProjectHandle {
  id: string
  name: string
  adapterType: "filesystem" | "indexeddb"
  /** File System Access API directory handle (session root folder) */
  dirHandle?: FileSystemDirectoryHandle
}

// ── Storage adapter interface ──

export interface StorageAdapter {
  readonly type: "filesystem" | "indexeddb"

  /** Create a new project folder/structure and return a handle */
  createProject(name: string, parentDirHandle?: FileSystemDirectoryHandle): Promise<ProjectHandle>

  /** Open an existing project and return the session snapshot */
  openProject(handle: ProjectHandle): Promise<SessionSnapshot>

  /** Persist the session JSON (and rotate autosave backups) */
  saveSession(handle: ProjectHandle, snapshot: SessionSnapshot): Promise<void>

  /** Store an audio file (recording or import) and return the relative path */
  saveAudioFile(handle: ProjectHandle, filename: string, blob: Blob): Promise<string>

  /** Load an audio file from the project and return a blob URL */
  loadAudioFile(handle: ProjectHandle, relativePath: string): Promise<string>

  /** Write autosave backups (rotated: autosave.json → autosave.1.json → autosave.2.json) */
  saveAutosaveBackup(handle: ProjectHandle, snapshot: SessionSnapshot): Promise<void>
}

// ── Folder structure constants ──

export const PROJECT_FOLDERS = ["audio", "renders", "waveforms", "backups"] as const
export const SESSION_FILENAME = "session.json"
export const AUTOSAVE_PREFIX = "session.autosave"
export const MAX_AUTOSAVE_BACKUPS = 3

// ── New session dialog values ──

export interface NewSessionConfig {
  name: string
  bpm: number
  sampleRate: number
  useFileSystem: boolean
  parentDirHandle?: FileSystemDirectoryHandle
}

// ── Feature detection ──

export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window
}
