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

  private async containsSession(parent: FileSystemDirectoryHandle, name: string): Promise<boolean> {
    try {
      const dir = await parent.getDirectoryHandle(name)
      await dir.getFileHandle(SESSION_FILENAME)
      return true
    } catch {
      return false // folder or session.json does not exist
    }
  }

  private async availableProjectName(parent: FileSystemDirectoryHandle, name: string): Promise<string> {
    if (!(await this.containsSession(parent, name))) return name
    for (let n = 2; n < 1000; n++) {
      const candidate = `${name} (${n})`
      if (!(await this.containsSession(parent, candidate))) return candidate
    }
    throw new Error(`Could not find a free folder name for "${name}"`)
  }

  // ── interface ──

  async createProject(
    name: string,
    parentDirHandle?: FileSystemDirectoryHandle,
  ): Promise<ProjectHandle> {
    const parent =
      parentDirHandle ??
      (await window.showDirectoryPicker({ mode: "readwrite" }))

    // Never reuse a folder that already holds a session: that would overwrite
    // the existing project's session.json. Pick "Name (2)", "Name (3)", ... instead.
    const folderName = await this.availableProjectName(parent, name)
    const projectDir = await this.getOrCreateDir(parent, folderName)

    // Scaffold sub-folders
    for (const folder of PROJECT_FOLDERS) {
      await this.getOrCreateDir(projectDir, folder)
    }

    const id = crypto.randomUUID()

    // Write an initial empty session.json
    const initial: Partial<SessionSnapshot> = {
      projectId: id,
      projectName: folderName,
      savedAt: Date.now(),
    }
    await this.writeJson(projectDir, SESSION_FILENAME, initial)

    return { id, name: folderName, adapterType: "filesystem", dirHandle: projectDir }
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
    return URL.createObjectURL(await this.loadAudioBlob(handle, relativePath))
  }

  async loadAudioBlob(handle: ProjectHandle, relativePath: string): Promise<Blob> {
    if (!handle.dirHandle) throw new Error("No directory handle")
    // relativePath is e.g. "audio/recording-1.wav"
    const parts = relativePath.split("/")
    let dir: FileSystemDirectoryHandle = handle.dirHandle
    for (const part of parts.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(part)
    }
    const file = await dir.getFileHandle(parts[parts.length - 1])
    return file.getFile()
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
