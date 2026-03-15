import { create } from "zustand"
import {
  StudioState,
  AudioSource,
  Clip,
  StudioTrack,
  TrackType,
  TimelineMarker,
  defaultMarkerColors,
  MixerChannel,
  FXType,
  UndoSnapshot,
  EffectsState,
  FXModuleState,
  defaultTrackFX,
  defaultMasterBus,
  defaultEffects,
  defaultTrackPresets,
  MAX_SESSION_SOURCES,
  ModalId,
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
  setTrackLaneHeight: (h: number) => void
  setProjectName: (name: string) => void

  // Track actions
  addTrack: (type: Exclude<TrackType, "master">, name?: string, color?: string) => string
  removeTrack: (trackId: string) => void
  updateTrack: (trackId: string, updates: Partial<Omit<StudioTrack, "id" | "type" | "channelId">>) => void
  setSelectedTrackId: (trackId: string | null) => void
  reorderTrack: (trackId: string, newIndex: number) => void
  moveTrackToBus: (trackId: string, busId: string | undefined) => void

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

  // Marker actions
  addMarker: (position: number, name: string, color?: string) => string
  removeMarker: (markerId: string) => void
  updateMarker: (markerId: string, updates: Partial<Omit<TimelineMarker, "id">>) => void

  // Panel actions
  togglePanel: (panel: keyof StudioState["panels"]) => void

  // Mixer channel actions (single source of truth for vol/pan/mute/solo)
  updateMixerChannel: (channelId: string, updates: Partial<Omit<MixerChannel, "id" | "trackId">>) => void

  // Per-track FX actions
  setTrackFXEnabled: (trackId: string, fxType: FXType, enabled: boolean) => void
  setTrackFXParam: (trackId: string, fxType: FXType, param: string, value: number | string) => void

  // Master bus
  setMasterVolume: (value: number) => void

  // FX actions (master bus effects)
  setEffectActive: (id: keyof Omit<EffectsState, "masterVolume">, active: boolean) => void
  setEffectParam: (id: keyof Omit<EffectsState, "masterVolume">, param: string, value: number | string) => void

  // Undo / Redo
  pushUndo: () => void
  undo: () => void
  redo: () => void

  // Clipboard
  cutClip: () => void
  copyClip: () => void
  pasteClip: () => void

  // Snap
  toggleSnapToGrid: () => void

  // Session
  newSession: () => void

  // Modal actions
  setActiveModal: (modal: ModalId) => void

  reset: () => void

  // Dirty tracking
  markDirty: () => void
  clearDirty: () => void
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
  mixerChannels: [],
  markers: [],
  masterBus: { ...defaultMasterBus },
  selectedTrackId: null,
  selectedClipId: null,
  panels: {
    mixer: true,
    pianoRoll: false,
    browser: false,
    export: false,
  },
  trackLaneHeight: 80,
  undoStack: [],
  redoStack: [],
  clipboard: null,
  effects: { ...defaultEffects },
  snapToGrid: true,
  isDirty: false,
  activeModal: null,
}

function snapshot(s: StudioState): UndoSnapshot {
  return { tracks: s.tracks, clips: s.clips, sources: s.sources, mixerChannels: s.mixerChannels }
}

export const useStudioStore = create<StudioState & StudioActions>()((set, get) => ({
  ...initialState,

  setPlaying: (playing) => set({ isPlaying: playing }),
  setRecording: (recording) => set({ isRecording: recording }),
  setPaused: (paused) => set({ isPaused: paused }),
  setPlayhead: (position) => set({ playhead: position }),
  setBpm: (bpm) => set({ bpm, isDirty: true }),
  setZoom: (zoom) => set({ zoom }),
  setTrackLaneHeight: (h: number) => set({ trackLaneHeight: h }),
  setProjectName: (name) => set({ projectName: name, isDirty: true }),

  // Tracks – returns the new track id, also creates linked mixer channel
  addTrack: (type, name, color) => {
    const trackId = generateId()
    const channelId = generateId()
    set((state) => {
      const count = state.tracks.filter((t) => t.type === type).length + 1
      const track: StudioTrack = {
        id: trackId,
        channelId,
        name: name ?? `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`,
        type,
        volume: 0.75,
        pan: 0,
        mute: false,
        solo: false,
        armed: false,
        color,
        order: state.tracks.length,
        fxChain: defaultTrackFX.map((fx) => ({ ...fx, params: { ...fx.params } })),
      }
      const channel: MixerChannel = {
        id: channelId,
        trackId,
        volume: 0.75,
        pan: 0,
        mute: false,
        solo: false,
      }
      return {
        tracks: [...state.tracks, track],
        mixerChannels: [...state.mixerChannels, channel],
        isDirty: true,
      }
    })
    return trackId
  },

  removeTrack: (trackId) =>
    set((state) => {
      const track = state.tracks.find((t) => t.id === trackId)
      return {
        tracks: state.tracks.filter((t) => t.id !== trackId),
        clips: state.clips.filter((c) => c.trackId !== trackId),
        mixerChannels: track
          ? state.mixerChannels.filter((ch) => ch.id !== track.channelId)
          : state.mixerChannels,
        selectedTrackId: state.selectedTrackId === trackId ? null : state.selectedTrackId,
        isDirty: true,
      }
    }),

  updateTrack: (trackId, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t)),
      isDirty: true,
    })),

  setSelectedTrackId: (trackId) => set({ selectedTrackId: trackId }),

  // Reorder tracks via drag
  reorderTrack: (trackId, newIndex) => {
    get().pushUndo()
    set((state) => {
      const tracks = [...state.tracks]
      const oldIndex = tracks.findIndex((t) => t.id === trackId)
      if (oldIndex === -1 || newIndex < 0 || newIndex >= tracks.length) return state
      const [moved] = tracks.splice(oldIndex, 1)
      tracks.splice(newIndex, 0, moved)
      // Update order field to match array position
      return { tracks: tracks.map((t, i) => ({ ...t, order: i })), isDirty: true }
    })
  },

  // Route a track to a bus
  moveTrackToBus: (trackId, busId) => {
    get().pushUndo()
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, busId } : t)),
      isDirty: true,
    }))
  },

  // SelectedTrackId: (trackId) => set({ selectedTrackId: trackId }),

  // Clips
  addClip: (clip) =>
    set((state) => {
      const id = generateId()
      return { clips: [...state.clips, { ...clip, id }], isDirty: true }
    }),

  removeClip: (clipId) =>
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== clipId),
      selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
      isDirty: true,
    })),

  updateClip: (clipId, updates) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
      isDirty: true,
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
      isDirty: true,
    }))
    return id
  },

  removeSource: (sourceId) =>
    set((state) => ({
      sources: state.sources.filter((s) => s.id !== sourceId),
      clips: state.clips.filter((c) => c.sourceId !== sourceId),
      isDirty: true,
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

  addMarker: (position, name, color) => {
    const id = generateId()
    set((state) => {
      const markerColor = color ?? defaultMarkerColors[state.markers.length % defaultMarkerColors.length]
      return { markers: [...state.markers, { id, position, name, color: markerColor }], isDirty: true }
    })
    return id
  },

  removeMarker: (markerId) =>
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== markerId),
      isDirty: true,
    })),

  updateMarker: (markerId, updates) =>
    set((state) => ({
      markers: state.markers.map((m) => (m.id === markerId ? { ...m, ...updates } : m)),
      isDirty: true,
    })),

  // Panels
  togglePanel: (panel) =>
    set((state) => ({
      panels: { ...state.panels, [panel]: !state.panels[panel] },
    })),

  // ── Mixer channel (authoritative for vol / pan / mute / solo) ──
  updateMixerChannel: (channelId, updates) =>
    set((state) => ({
      mixerChannels: state.mixerChannels.map((ch) =>
        ch.id === channelId ? { ...ch, ...updates } : ch,
      ),
      isDirty: true,
    })),

  // ── Per-track FX ──
  setTrackFXEnabled: (trackId, fxType, enabled) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              fxChain: t.fxChain.map((fx) =>
                fx.type === fxType ? { ...fx, enabled } : fx,
              ),
            }
          : t,
      ),
      isDirty: true,
    })),

  setTrackFXParam: (trackId, fxType, param, value) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              fxChain: t.fxChain.map((fx) =>
                fx.type === fxType ? { ...fx, params: { ...fx.params, [param]: value } } : fx,
              ),
            }
          : t,
      ),
      isDirty: true,
    })),

  // Master bus
  setMasterVolume: (value) =>
    set((state) => ({
      masterBus: { ...state.masterBus, volume: value },
      effects: { ...state.effects, masterVolume: value },
      isDirty: true,
    })),

  // ── Master FX actions ──
  setEffectActive: (id, active) =>
    set((state) => ({
      effects: {
        ...state.effects,
        [id]: { ...state.effects[id], active },
      },
      isDirty: true,
    })),

  setEffectParam: (id, param, value) =>
    set((state) => {
      const mod = state.effects[id] as FXModuleState & { time?: string }
      if (param === "time") {
        return { effects: { ...state.effects, [id]: { ...mod, time: value as string } }, isDirty: true }
      }
      return {
        effects: {
          ...state.effects,
          [id]: { ...mod, params: { ...mod.params, [param]: value as number } },
        },
        isDirty: true,
      }
    }),

  // ── Undo / Redo ──
  pushUndo: () =>
    set((state) => ({
      undoStack: [...state.undoStack.slice(-29), snapshot(state)],
      redoStack: [],
    })),

  undo: () => {
    const state = get()
    const stack = [...state.undoStack]
    const snap = stack.pop()
    if (!snap) return
    set({
      undoStack: stack,
      redoStack: [...state.redoStack, snapshot(state)],
      tracks: snap.tracks,
      clips: snap.clips,
      sources: snap.sources,
      mixerChannels: snap.mixerChannels,
    })
  },

  redo: () => {
    const state = get()
    const stack = [...state.redoStack]
    const snap = stack.pop()
    if (!snap) return
    set({
      redoStack: stack,
      undoStack: [...state.undoStack, snapshot(state)],
      tracks: snap.tracks,
      clips: snap.clips,
      sources: snap.sources,
      mixerChannels: snap.mixerChannels,
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

  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid, isDirty: true })),

  // ── Session ──
  newSession: () => {
    // Full reset first
    set({ ...initialState, masterBus: { ...defaultMasterBus }, isDirty: false })

    const store = get()

    // Create a Vocal Bus first so presets can route to it
    const vocalBusId = store.addTrack("bus", "Vocal Bus", "hsl(340 80% 55%)")

    // Create the 4 default tracks (addTrack also creates mixer channels)
    for (const preset of defaultTrackPresets) {
      const trackId = store.addTrack(preset.type, preset.name, preset.color)
      if (preset.armed) {
        store.updateTrack(trackId, { armed: true })
      }
      // Route tracks marked for vocal bus
      if (preset.busId === "__vocal_bus__") {
        store.moveTrackToBus(trackId, vocalBusId)
      }
    }
    // Select the first armed track
    const armed = get().tracks.find((t) => t.armed)
    if (armed) set({ selectedTrackId: armed.id })
    // New session starts clean
    set({ isDirty: false })
  },

  // Modals
  setActiveModal: (modal) => set({ activeModal: modal }),

  // Reset
  reset: () => {
    set({ ...initialState, masterBus: { ...defaultMasterBus }, isDirty: false })
  },

  // ── Dirty tracking ──
  markDirty: () => set({ isDirty: true }),
  clearDirty: () => set({ isDirty: false }),
}))
