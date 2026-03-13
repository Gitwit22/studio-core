import { create } from "zustand"
import { StudioState } from "../types/studio"

interface StudioActions {
  setPlaying: (playing: boolean) => void
  setRecording: (recording: boolean) => void
  setPlayhead: (position: number) => void
  setBpm: (bpm: number) => void
  addTrack: (type: "audio" | "midi" | "bus") => void
  selectTrack: (trackId: string | null) => void
  togglePanel: (panel: keyof StudioState["panels"]) => void
}

export const useStudioStore = create<StudioState & StudioActions>()((set) => ({
  projectId: null,
  projectName: "Untitled Project",
  isPlaying: false,
  isRecording: false,
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
  selectedTrackId: null,
  selectedClipId: null,
  panels: {
    mixer: false,
    pianoRoll: false,
    browser: true,
    export: false,
  },

  setPlaying: (playing) => set({ isPlaying: playing }),
  setRecording: (recording) => set({ isRecording: recording }),
  setPlayhead: (position) => set({ playhead: position }),
  setBpm: (bpm) => set({ bpm }),

  addTrack: (type) =>
    set((state) => ({
      tracks: [
        ...state.tracks,
        {
          id: crypto.randomUUID(),
          name: `${type[0].toUpperCase()}${type.slice(1)} Track ${state.tracks.length + 1}`,
          type,
          volume: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          armed: false,
        },
      ],
    })),

  selectTrack: (trackId) => set({ selectedTrackId: trackId }),

  togglePanel: (panel) =>
    set((state) => ({
      panels: {
        ...state.panels,
        [panel]: !state.panels[panel],
      },
    })),
}))
