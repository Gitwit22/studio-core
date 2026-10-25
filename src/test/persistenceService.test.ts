import { describe, it, expect, beforeEach, vi } from "vitest"
import { useStudioStore } from "@/studio/engine/studioStore"
import { persistenceService } from "@/studio/persistence/PersistenceService"
import { FileSystemAdapter } from "@/studio/persistence/FileSystemAdapter"
import type { StorageAdapter, ProjectHandle } from "@/studio/persistence/types"
import type { SessionSnapshot } from "@/studio/types/studio"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock("@/studio/persistence/RecentSessions", () => ({
  recentSessions: { add: vi.fn(), touch: vi.fn(), list: vi.fn().mockResolvedValue([]) },
}))
vi.mock("@/studio/persistence/handleStore", () => ({
  storeHandle: vi.fn(),
  retrieveHandle: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/studio/persistence/cloudStateSync", async (orig) => ({
  ...(await orig<typeof import("@/studio/persistence/cloudStateSync")>()),
  getStudioApiBaseUrl: () => null,
}))

function makeAdapter(overrides: Partial<StorageAdapter> = {}) {
  const sessions = new Map<string, SessionSnapshot>()
  const adapter = {
    type: "indexeddb" as const,
    sessions,
    createProject: vi.fn(async (name: string): Promise<ProjectHandle> => ({
      id: crypto.randomUUID(), name, adapterType: "indexeddb",
    })),
    openProject: vi.fn(async (h: ProjectHandle) => sessions.get(h.id)!),
    saveSession: vi.fn(async (h: ProjectHandle, s: SessionSnapshot) => { sessions.set(h.id, s) }),
    saveAudioFile: vi.fn(async (_h: ProjectHandle, filename: string) => `audio/${filename}`),
    loadAudioFile: vi.fn(async () => "blob:test"),
    saveAutosaveBackup: vi.fn(async () => {}),
    ...overrides,
  }
  return adapter
}

type Internals = { adapter: StorageAdapter | null; handle: ProjectHandle | null }
const internals = () => persistenceService as unknown as Internals

function attach(adapter: StorageAdapter, id = "project-a") {
  const handle: ProjectHandle = { id, name: id, adapterType: "indexeddb" }
  internals().adapter = adapter
  internals().handle = handle
  return handle
}

describe("PersistenceService dirty tracking", () => {
  beforeEach(() => {
    persistenceService.stopAutosave()
    internals().adapter = null
    internals().handle = null
    useStudioStore.getState().reset()
    useStudioStore.getState().newSession()
  })

  it("treats ordinary timeline/mixer edits as unsaved work", async () => {
    const adapter = makeAdapter()
    attach(adapter)
    const track = useStudioStore.getState().tracks[0]
    useStudioStore.getState().updateMixerChannel(track.channelId, { volume: 0.2 })

    expect(persistenceService.isDirty).toBe(true)
    await persistenceService.immediateSaveIfDirty()

    expect(adapter.saveSession).toHaveBeenCalledTimes(1)
    const saved = vi.mocked(adapter.saveSession).mock.calls[0][1] as SessionSnapshot
    expect(saved.mixerChannels.find((c) => c.id === track.channelId)?.volume).toBe(0.2)
    expect(persistenceService.isDirty).toBe(false)
  })

  it("keeps the session dirty when the store changes while a save is in flight", async () => {
    let release!: () => void
    const adapter = makeAdapter({
      saveSession: vi.fn(() => new Promise<void>((r) => { release = r })),
    })
    attach(adapter)
    useStudioStore.getState().setBpm(100)

    const pending = persistenceService.save()
    useStudioStore.getState().setBpm(140) // edit made during the async write
    release()
    await pending

    expect(persistenceService.isDirty).toBe(true)
  })

  it.each([
    ["undo", (s: ReturnType<typeof useStudioStore.getState>) => { s.pushUndo(); s.clearDirty(); s.undo() }],
    ["redo", (s: ReturnType<typeof useStudioStore.getState>) => { s.pushUndo(); s.undo(); s.clearDirty(); s.redo() }],
  ])("%s marks the session dirty", (_name, act) => {
    act(useStudioStore.getState())
    expect(useStudioStore.getState().isDirty).toBe(true)
  })

  it("cut and paste mark the session dirty", () => {
    const s = useStudioStore.getState()
    const trackId = s.tracks[0].id
    s.addClip({ trackId, sourceId: "src", start: 0, end: 4, offset: 0, name: "c" })
    const clipId = useStudioStore.getState().clips[0].id
    useStudioStore.getState().setSelectedClipId(clipId)
    useStudioStore.getState().clearDirty()

    useStudioStore.getState().cutClip()
    expect(useStudioStore.getState().isDirty).toBe(true)

    useStudioStore.getState().clearDirty()
    useStudioStore.getState().pasteClip()
    expect(useStudioStore.getState().isDirty).toBe(true)
  })
})

describe("PersistenceService audio + project switching", () => {
  beforeEach(() => {
    persistenceService.stopAutosave()
    internals().adapter = null
    internals().handle = null
    useStudioStore.getState().reset()
    useStudioStore.getState().newSession()
  })

  it("never reuses a file name for two imports with the same name", async () => {
    const adapter = makeAdapter()
    attach(adapter)
    const a = await persistenceService.saveAudio("vocal.wav", new Blob(["a"]))
    const b = await persistenceService.saveAudio("vocal.wav", new Blob(["b"]))
    expect(a).not.toBe(b)
    expect(a.endsWith("vocal.wav")).toBe(true)
  })

  it("saves unsaved work in the current project before creating a new one", async () => {
    const adapter = makeAdapter()
    const oldHandle = attach(adapter, "old-project")
    useStudioStore.getState().setProjectName("Old work")
    const IDB = (await import("@/studio/persistence/IndexedDbAdapter")).IndexedDbAdapter
    const createSpy = vi.spyOn(IDB.prototype, "createProject")
      .mockResolvedValue({ id: "new-project", name: "Fresh", adapterType: "indexeddb" })
    const saveSpy = vi.spyOn(IDB.prototype, "saveSession").mockResolvedValue()

    await persistenceService.createSession({ name: "Fresh", bpm: 90, sampleRate: 48000, useFileSystem: false })
    persistenceService.stopAutosave()
    createSpy.mockRestore()
    saveSpy.mockRestore()

    expect(vi.mocked(adapter.saveSession).mock.calls[0][0]).toBe(oldHandle)
    expect((vi.mocked(adapter.saveSession).mock.calls[0][1] as SessionSnapshot).projectName).toBe("Old work")
    expect(internals().handle?.id).not.toBe("old-project")
  })

  it("keeps the current project active if opening another one fails", async () => {
    const adapter = makeAdapter()
    const current = attach(adapter, "current")
    const openSpy = vi
      .spyOn(
        (await import("@/studio/persistence/IndexedDbAdapter")).IndexedDbAdapter.prototype,
        "openProject",
      )
      .mockRejectedValue(new Error("missing"))

    await expect(
      persistenceService.openSession({ id: "other", name: "Other", path: "", lastOpenedAt: 0, adapterType: "indexeddb" }),
    ).rejects.toThrow("missing")
    persistenceService.stopAutosave()

    expect(internals().handle).toBe(current)
    expect(internals().adapter).toBe(adapter)
    openSpy.mockRestore()
  })

  it("fills clip defaults for sessions saved before clip gain/rate existed", async () => {
    const legacyClip = { id: "c1", trackId: "t1", sourceId: "s1", start: 0, end: 8, offset: 0, name: "old" }
    const IDB = (await import("@/studio/persistence/IndexedDbAdapter")).IndexedDbAdapter
    const openSpy = vi.spyOn(IDB.prototype, "openProject").mockResolvedValue({
      projectId: "legacy", projectName: "Legacy", bpm: 120, zoom: 1,
      loop: { start: 0, end: 8, enabled: false }, masterBus: { volume: 80 },
      tracks: [], clips: [legacyClip], mixerChannels: [], sources: [],
      effects: useStudioStore.getState().effects, markers: [], snapToGrid: true, savedAt: 0,
    } as unknown as SessionSnapshot)

    await persistenceService.openSession({ id: "legacy", name: "Legacy", path: "", lastOpenedAt: 0, adapterType: "indexeddb" })
    persistenceService.stopAutosave()

    useStudioStore.getState().splitClip("c1", 4)
    const right = useStudioStore.getState().clips.find((c) => c.start === 4)!
    expect(right.offset).toBe(4)
    expect(right.playbackRate).toBe(1)
    openSpy.mockRestore()
  })
})

describe("FileSystemAdapter.createProject", () => {
  function fakeDir(entries: Record<string, unknown> = {}): FileSystemDirectoryHandle {
    const dir = {
      kind: "directory",
      name: "root",
      entries,
      async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
        if (!entries[name]) {
          if (!opts?.create) throw new DOMException("not found", "NotFoundError")
          entries[name] = fakeDir()
        }
        return entries[name]
      },
      async getFileHandle(name: string, opts?: { create?: boolean }) {
        if (!entries[name]) {
          if (!opts?.create) throw new DOMException("not found", "NotFoundError")
          entries[name] = {
            kind: "file",
            name,
            createWritable: async () => ({ write: async () => {}, close: async () => {} }),
          }
        }
        return entries[name]
      },
    }
    return dir as unknown as FileSystemDirectoryHandle
  }

  it("does not overwrite an existing session folder with the same name", async () => {
    const parent = fakeDir()
    const adapter = new FileSystemAdapter()
    const first = await adapter.createProject("Song", parent)
    const second = await adapter.createProject("Song", parent)

    expect(first.name).toBe("Song")
    expect(second.name).toBe("Song (2)")
    expect(second.dirHandle).not.toBe(first.dirHandle)
  })
})
