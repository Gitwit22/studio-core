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
  waveform?: number[]
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

// ── FX state types ──

export interface FXModuleState {
  active: boolean
  params: Record<string, number>
}

export interface EffectsState {
  compressor: FXModuleState
  delay: FXModuleState & { time: string }
  reverb: FXModuleState
  eq: FXModuleState
  limiter: FXModuleState
  masterVolume: number
}

export const defaultEffects: EffectsState = {
  compressor: { active: true, params: { amount: 65 } },
  delay: { active: false, time: "1/4", params: { mix: 30 } },
  reverb: { active: true, params: { size: 45, mix: 40 } },
  eq: { active: true, params: { low: 50, mid: 55, high: 50 } },
  limiter: { active: true, params: { ceiling: 75, gain: 50 } },
  masterVolume: 80,
}

// ── Session guardrails ──

/** Approximate max sources before a memory warning is shown */
export const MAX_SESSION_SOURCES = 50

// ── Default track presets for new sessions ──

export const defaultTrackPresets: { name: string; color: string; armed: boolean }[] = [
  { name: "Beat", color: "hsl(217 100% 71%)", armed: false },
  { name: "Lead Vocal", color: "hsl(172 72% 55%)", armed: true },
  { name: "Double", color: "hsl(45 100% 60%)", armed: false },
  { name: "Ad-Lib", color: "hsl(280 70% 60%)", armed: false },
]

// ── Undo / Redo snapshot ──

export interface UndoSnapshot {
  tracks: StudioTrack[]
  clips: Clip[]
  sources: AudioSource[]
}

export interface StudioState {
  projectId: string | null
  projectName: string
  isPlaying: boolean
  isRecording: boolean
  isPaused: boolean
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
  effects: EffectsState
  undoStack: UndoSnapshot[]
  redoStack: UndoSnapshot[]
  clipboard: Clip | null
}
