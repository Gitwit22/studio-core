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

export interface AudioSource {
  id: string
  name: string
  file?: File
  url: string
  duration: number
  /** @deprecated Use WaveformPeaks from waveform pipeline instead. */
  waveform?: number[]
  /** Status of waveform peak generation for this source. */
  waveformStatus?: import("./waveform").WaveformStatus
}

export interface Clip {
  id: string
  trackId: string
  sourceId: string
  start: number        // timeline beat position
  end: number          // timeline beat position
  offset: number       // offset inside source in beats or seconds depending on engine choice
  name: string
  color?: string
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

export type ModalId =
  | "newSession"
  | "openSession"
  | "saveSessionAs"
  | "sessionInfo"
  | "exportMix"
  | "settings"
  | "keyboardShortcuts"
  | "quickStart"
  | "troubleshooting"
  | "reportProblem"
  | "about"
  | "confirmDelete"
  | "unsavedChanges"
  | null

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
  sources: AudioSource[]
  selectedTrackId: string | null
  selectedClipId: string | null
  panels: StudioPanels
  activeModal: ModalId
}
