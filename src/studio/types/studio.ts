export type TrackType = "audio" | "midi" | "bus" | "master"

export interface StudioTrack {
  id: string
  name: string
  type: TrackType
  volume: number
  pan: number
  mute: boolean
  solo: boolean
  armed: boolean
  color?: string
}

export interface Clip {
  id: string
  trackId: string
  start: number
  end: number
  name: string
  sourceUrl?: string
}

export interface LoopRegion {
  start: number
  end: number
  enabled: boolean
}

export interface StudioPanels {
  mixer: boolean
  pianoRoll: boolean
  browser: boolean
  export: boolean
}

export interface StudioState {
  projectId: string | null
  projectName: string
  isPlaying: boolean
  isRecording: boolean
  bpm: number
  playhead: number
  zoom: number
  loop: LoopRegion
  tracks: StudioTrack[]
  clips: Clip[]
  selectedTrackId: string | null
  selectedClipId: string | null
  panels: StudioPanels
}
