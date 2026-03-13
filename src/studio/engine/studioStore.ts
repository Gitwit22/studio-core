import { create } from "zustand"
import { StudioState, AudioSource, Clip, StudioTrack, TrackType } from "../types/studio"

function generateId(): string {
  return crypto.randomUUID()
}

interface StudioActions {
  setPlaying: (playing: boolean) => void
  setRecording: (recording: boolean) => void
  setPlayhead: (position: number) => void
  setBpm: (bpm: number) => void
  setZoom: (zoom: number) => void
  setProjectName: (name: string) => void

  // Track actions
  addTrack: (type: Exclude<TrackType, "master">, name?: string) => void
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

  // Reset
  reset: () => void
}

const initialState: StudioState = {
  projectId: null,
  projectName: "Untitled Project",
  isPlaying: false,
  isRecording: false,
  bpm: 120,
  playhead: 0,
  zoom: 1,
  loop: { start: 0, end: 8, enabled: false },
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
}

export const useStudioStore = create<StudioState & StudioActions>()((set) => ({
  ...initialState,

  // Transport
  setPlaying: (playing) => set({ isPlaying: playing }),
  setRecording: (recording) => set({ isRecording: recording }),
  setPlayhead: (position) => set({ playhead: position }),
  setBpm: (bpm) => set({ bpm }),
  setZoom: (zoom) => set({ zoom }),
  setProjectName: (name) => set({ projectName: name }),

  // Tracks
  addTrack: (type, name) =>
    set((state) => {
      const id = generateId()
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
      }
      return { tracks: [...state.tracks, track] }
    }),

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

  // Sources
  addSource: (source) => {
    const id = generateId()
    set((state) => ({
      sources: [...state.sources, { ...source, id }],
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

  // Reset
  reset: () => {
    set(initialState)
  },
}))
