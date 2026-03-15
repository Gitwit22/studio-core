import type { StorageAdapter, ProjectHandle } from "./types"
import {
  PROJECT_FOLDERS,
  SESSION_FILENAME,
  AUTOSAVE_PREFIX,
  MAX_AUTOSAVE_BACKUPS,
} from "./types"
import type { SessionSnapshot } from "../types/studio"

/**
 * StorageAdapter backed by the File System Access API.
 * Creates a real folder structure on disk:
 *   [parentDir]/[SessionName]/session.json
 *                             audio/
 *                             renders/
 *                             waveforms/
 *                             backups/
 */
export class FileSystemAdapter implements StorageAdapter {
  readonly type = "filesystem" as const

  // ── helpers ──

  private async getOrCreateDir(
    parent: FileSystemDirectoryHandle,
    name: string,
  ): Promise<FileSystemDirectoryHandle> {
    return parent.getDirectoryHandle(name, { create: true })
  }

  private async writeJson(dir: FileSystemDirectoryHandle, name: string, data: unknown) {
    const file = await dir.getFileHandle(name, { create: true })
    const writable = await file.createWritable()
    await writable.write(JSON.stringify(data, null, 2))
    await writable.close()
  }

  private async readJson<T>(dir: FileSystemDirectoryHandle, name: string): Promise<T> {
    const file = await dir.getFileHandle(name)
    const blob = await file.getFile()
    return JSON.parse(await blob.text()) as T
  }

  // ── interface ──

  async createProject(
    name: string,
    parentDirHandle?: FileSystemDirectoryHandle,
  ): Promise<ProjectHandle> {
    const parent =
      parentDirHandle ??
      (await window.showDirectoryPicker({ mode: "readwrite" }))

    const projectDir = await this.getOrCreateDir(parent, name)

    // Scaffold sub-folders
    for (const folder of PROJECT_FOLDERS) {
      await this.getOrCreateDir(projectDir, folder)
    }

    const id = crypto.randomUUID()

    // Write an initial empty session.json
    const initial: Partial<SessionSnapshot> = {
      projectId: id,
      projectName: name,
      savedAt: Date.now(),
    }
    await this.writeJson(projectDir, SESSION_FILENAME, initial)

    return { id, name, adapterType: "filesystem", dirHandle: projectDir }
  }

  async openProject(handle: ProjectHandle): Promise<SessionSnapshot> {
    if (!handle.dirHandle) throw new Error("No directory handle")
    return this.readJson<SessionSnapshot>(handle.dirHandle, SESSION_FILENAME)
  }

  async saveSession(handle: ProjectHandle, snapshot: SessionSnapshot): Promise<void> {
    if (!handle.dirHandle) throw new Error("No directory handle")
    await this.writeJson(handle.dirHandle, SESSION_FILENAME, snapshot)
  }

  async saveAudioFile(
    handle: ProjectHandle,
    filename: string,
    blob: Blob,
  ): Promise<string> {
    if (!handle.dirHandle) throw new Error("No directory handle")
    const audioDir = await this.getOrCreateDir(handle.dirHandle, "audio")
    const fileHandle = await audioDir.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    return `audio/${filename}`
  }

  async loadAudioFile(handle: ProjectHandle, relativePath: string): Promise<string> {
    if (!handle.dirHandle) throw new Error("No directory handle")
    // relativePath is e.g. "audio/recording-1.wav"
    const parts = relativePath.split("/")
    let dir: FileSystemDirectoryHandle = handle.dirHandle
    for (const part of parts.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(part)
    }
    const file = await dir.getFileHandle(parts[parts.length - 1])
    const blob = await file.getFile()
    return URL.createObjectURL(blob)
  }

  async saveAutosaveBackup(handle: ProjectHandle, snapshot: SessionSnapshot): Promise<void> {
    if (!handle.dirHandle) throw new Error("No directory handle")
    const backupDir = await this.getOrCreateDir(handle.dirHandle, "backups")

    // Rotate: autosave.2 ← autosave.1 ← autosave ← current
    for (let i = MAX_AUTOSAVE_BACKUPS - 1; i >= 1; i--) {
      const srcName = i === 1
        ? `${AUTOSAVE_PREFIX}.json`
        : `${AUTOSAVE_PREFIX}.${i - 1}.json`
      const destName = `${AUTOSAVE_PREFIX}.${i}.json`
      try {
        const srcFile = await backupDir.getFileHandle(srcName)
        const blob = await srcFile.getFile()
        const destFile = await backupDir.getFileHandle(destName, { create: true })
        const writable = await destFile.createWritable()
        await writable.write(blob)
        await writable.close()
      } catch {
        // Source file doesn't exist yet — skip
      }
    }

    // Write current autosave
    await this.writeJson(backupDir, `${AUTOSAVE_PREFIX}.json`, snapshot)
  }
}
