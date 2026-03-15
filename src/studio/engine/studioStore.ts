import { create } from "zustand"
import {
  StudioState,
  AudioSource,
  Clip,
  StudioTrack,
  TrackType,
  EffectsState,
  FXModuleState,
  UndoSnapshot,
  defaultEffects,
  defaultTrackPresets,
  MAX_SESSION_SOURCES,
} from "../types/studio"

function generateId(): string {
  return crypto.randomUUID()
}

interface StudioActions {
  setPlaying: (playing: boolean) => void
  setRecording: (recording: boolean) => void
  setPaused: (paused: boolean) => void
  setPlayhead: (position: number) => void
  setBpm: (bpm: number) => void
  setZoom: (zoom: number) => void
  setProjectName: (name: string) => void

  // Track actions
  addTrack: (type: Exclude<TrackType, "master">, name?: string, color?: string) => string
  removeTrack: (trackId: string) => void
  updateTrack: (trackId: string, updates: Partial<Omit<StudioTrack, "id" | "type">>) => void
  setSelectedTrackId: (trackId: string | null) => void

  // Clip actions
  addClip: (clip: Omit<Clip, "id">) => void
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<Omit<Clip, "id">>) => void
  setSelectedClipId: (clipId: string | null) => void

  // Source actions
  addSource: (source: Omit<AudioSource, "id">) => string
  removeSource: (sourceId: string) => void

  // Loop actions
  setLoop: (start: number, end: number) => void
  toggleLoop: () => void

  // Panel actions
  togglePanel: (panel: keyof StudioState["panels"]) => void

  // FX actions
  setEffectActive: (id: keyof Omit<EffectsState, "masterVolume">, active: boolean) => void
  setEffectParam: (id: keyof Omit<EffectsState, "masterVolume">, param: string, value: number | string) => void
  setMasterVolume: (value: number) => void

  // Undo / Redo
  pushUndo: () => void
  undo: () => void
  redo: () => void

  // Clipboard
  cutClip: () => void
  copyClip: () => void
  pasteClip: () => void

  // Session
  newSession: () => void
  reset: () => void
}

const initialState: StudioState = {
  projectId: null,
  projectName: "Untitled Session",
  isPlaying: false,
  isRecording: false,
  isPaused: false,
  bpm: 120,
  playhead: 0,
  zoom: 1,
  loop: {
    start: 0,
    end: 8,
    enabled: false,
  },
  tracks: [],
  clips: [],
  sources: [],
  selectedTrackId: null,
  selectedClipId: null,
  panels: {
    mixer: true,
    pianoRoll: false,
    browser: false,
    export: false,
  },
  effects: { ...defaultEffects },
  undoStack: [],
  redoStack: [],
  clipboard: null,
}

export const useStudioStore = create<StudioState & StudioActions>()((set, get) => ({
  ...initialState,

  setPlaying: (playing) => set({ isPlaying: playing }),
  setRecording: (recording) => set({ isRecording: recording }),
  setPaused: (paused) => set({ isPaused: paused }),
  setPlayhead: (position) => set({ playhead: position }),
  setBpm: (bpm) => set({ bpm }),
  setZoom: (zoom) => set({ zoom }),
  setProjectName: (name) => set({ projectName: name }),

  // Tracks – returns the new track id
  addTrack: (type, name, color) => {
    const id = generateId()
    set((state) => {
      const count = state.tracks.filter((t) => t.type === type).length + 1
      const track: StudioTrack = {
        id,
        name: name ?? `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`,
        type,
        volume: 0.75,
        pan: 0,
        mute: false,
        solo: false,
        armed: false,
        color,
      }
      return { tracks: [...state.tracks, track] }
    })
    return id
  },

  removeTrack: (trackId) =>
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
      clips: state.clips.filter((c) => c.trackId !== trackId),
      selectedTrackId: state.selectedTrackId === trackId ? null : state.selectedTrackId,
    })),

  updateTrack: (trackId, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t)),
    })),

  setSelectedTrackId: (trackId) => set({ selectedTrackId: trackId }),

  // Clips
  addClip: (clip) =>
    set((state) => {
      const id = generateId()
      return { clips: [...state.clips, { ...clip, id }] }
    }),

  removeClip: (clipId) =>
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== clipId),
      selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
    })),

  updateClip: (clipId, updates) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
    })),

  setSelectedClipId: (clipId) => set({ selectedClipId: clipId }),

  // Sources – with guardrail
  addSource: (source) => {
    const state = get()
    if (state.sources.length >= MAX_SESSION_SOURCES) {
      console.warn(`Session source limit (${MAX_SESSION_SOURCES}) reached. Save and start a new session.`)
    }
    const id = generateId()
    set((s) => ({
      sources: [...s.sources, { ...source, id }],
    }))
    return id
  },

  removeSource: (sourceId) =>
    set((state) => ({
      sources: state.sources.filter((s) => s.id !== sourceId),
      clips: state.clips.filter((c) => c.sourceId !== sourceId),
    })),

  // Loop
  setLoop: (start, end) =>
    set((state) => ({
      loop: { ...state.loop, start, end },
    })),

  toggleLoop: () =>
    set((state) => ({
      loop: { ...state.loop, enabled: !state.loop.enabled },
    })),

  // Panels
  togglePanel: (panel) =>
    set((state) => ({
      panels: { ...state.panels, [panel]: !state.panels[panel] },
    })),

  // ── FX actions ──
  setEffectActive: (id, active) =>
    set((state) => ({
      effects: {
        ...state.effects,
        [id]: { ...state.effects[id], active },
      },
    })),

  setEffectParam: (id, param, value) =>
    set((state) => {
      const mod = state.effects[id] as FXModuleState & { time?: string }
      // "time" lives at top‑level on delay, everything else is in params
      if (param === "time") {
        return { effects: { ...state.effects, [id]: { ...mod, time: value as string } } }
      }
      return {
        effects: {
          ...state.effects,
          [id]: { ...mod, params: { ...mod.params, [param]: value as number } },
        },
      }
    }),

  setMasterVolume: (value) =>
    set((state) => ({
      effects: { ...state.effects, masterVolume: value },
    })),

  // ── Undo / Redo ──
  pushUndo: () =>
    set((state) => ({
      undoStack: [
        ...state.undoStack.slice(-29), // keep last 30
        { tracks: state.tracks, clips: state.clips, sources: state.sources },
      ],
      redoStack: [],
    })),

  undo: () => {
    const state = get()
    const stack = [...state.undoStack]
    const snap = stack.pop()
    if (!snap) return
    set({
      undoStack: stack,
      redoStack: [
        ...state.redoStack,
        { tracks: state.tracks, clips: state.clips, sources: state.sources },
      ],
      tracks: snap.tracks,
      clips: snap.clips,
      sources: snap.sources,
    })
  },

  redo: () => {
    const state = get()
    const stack = [...state.redoStack]
    const snap = stack.pop()
    if (!snap) return
    set({
      redoStack: stack,
      undoStack: [
        ...state.undoStack,
        { tracks: state.tracks, clips: state.clips, sources: state.sources },
      ],
      tracks: snap.tracks,
      clips: snap.clips,
      sources: snap.sources,
    })
  },

  // ── Clipboard ──
  cutClip: () => {
    const state = get()
    const clip = state.clips.find((c) => c.id === state.selectedClipId)
    if (!clip) return
    get().pushUndo()
    set((s) => ({
      clipboard: clip,
      clips: s.clips.filter((c) => c.id !== clip.id),
      selectedClipId: null,
    }))
  },

  copyClip: () => {
    const state = get()
    const clip = state.clips.find((c) => c.id === state.selectedClipId)
    if (clip) set({ clipboard: clip })
  },

  pasteClip: () => {
    const state = get()
    if (!state.clipboard) return
    get().pushUndo()
    const id = generateId()
    const pasted: Clip = {
      ...state.clipboard,
      id,
      start: state.playhead,
      end: state.playhead + (state.clipboard.end - state.clipboard.start),
    }
    set((s) => ({
      clips: [...s.clips, pasted],
      selectedClipId: id,
    }))
  },

  // ── Session ──
  newSession: () => {
    // Full reset first
    set({ ...initialState, effects: { ...defaultEffects } })

    // Create the 4 default tracks
    const store = get()
    for (const preset of defaultTrackPresets) {
      const trackId = store.addTrack("audio", preset.name, preset.color)
      if (preset.armed) {
        store.updateTrack(trackId, { armed: true })
      }
    }
    // Select the first armed track
    const armed = get().tracks.find((t) => t.armed)
    if (armed) set({ selectedTrackId: armed.id })
  },

  // Reset
  reset: () => {
    set({ ...initialState, effects: { ...defaultEffects } })
  },
}))
