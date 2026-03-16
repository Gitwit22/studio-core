export type TrackType = "audio" | "vocal" | "instrument" | "beat" | "bus" | "midi" | "master"

// ── Per-track FX types ──

export type FXType = "compressor" | "delay" | "reverb" | "eq" | "pitchShifter" | "limiter"

export interface TrackFXSlot {
  type: FXType
  enabled: boolean
  params: Record<string, number | string>
}

export const defaultTrackFX: TrackFXSlot[] = [
  { type: "compressor", enabled: true, params: { amount: 65 } },
  { type: "delay", enabled: false, params: { time: "1/4", mix: 30 } },
  { type: "reverb", enabled: true, params: { size: 45, mix: 40 } },
  { type: "eq", enabled: true, params: { low: 50, mid: 55, high: 50 } },
  { type: "pitchShifter", enabled: false, params: { semitones: 50 } },
  { type: "limiter", enabled: true, params: { ceiling: 75, gain: 50 } },
]

// ── Mixer channel ──

export interface MixerChannel {
  id: string
  trackId: string
  volume: number     // 0-1 linear
  pan: number        // -1 to 1
  mute: boolean
  solo: boolean
}

// ── Track ──

export interface StudioTrack {
  id: string
  channelId: string   // links to MixerChannel
  name: string
  type: TrackType
  volume: number      // 0-1 linear
  pan: number          // -1 to 1
  mute: boolean
  solo: boolean
  armed: boolean
  color?: string
  frozen?: boolean
  busId?: string       // if routed to a bus track
  inputDeviceId?: string // mic device id (vocal tracks only)
  order: number        // display order for drag-reorder
  fxChain: TrackFXSlot[]
}

// ── Timeline markers ──

export interface TimelineMarker {
  id: string
  position: number   // beat position
  name: string
  color: string
}

export const defaultMarkerColors = [
  "hsl(172 72% 55%)",  // teal
  "hsl(45 100% 60%)",  // yellow
  "hsl(280 70% 60%)",  // purple
  "hsl(217 100% 71%)", // blue
  "hsl(0 100% 62%)",   // red
]

// ── Track type display config ──

export const trackTypeConfig: Record<TrackType, { label: string; defaultColor: string; icon: string }> = {
  audio: { label: "Audio", defaultColor: "hsl(217 100% 71%)", icon: "♪" },
  vocal: { label: "Vocal", defaultColor: "hsl(142 60% 50%)", icon: "🎤" },
  instrument: { label: "Instrument", defaultColor: "hsl(45 100% 60%)", icon: "🎹" },
  beat: { label: "Beat", defaultColor: "hsl(217 100% 71%)", icon: "🥁" },
  bus: { label: "Bus", defaultColor: "hsl(340 80% 55%)", icon: "⊞" },
  midi: { label: "MIDI", defaultColor: "hsl(120 60% 50%)", icon: "⌨" },
  master: { label: "Master", defaultColor: "hsl(0 0% 70%)", icon: "M" },
}

/** Predefined palette for track color coding */
export const trackColorPalette: Record<string, string> = {
  blue: "hsl(217 100% 71%)",
  green: "hsl(142 60% 50%)",
  purple: "hsl(280 70% 60%)",
  yellow: "hsl(45 100% 60%)",
  teal: "hsl(172 72% 55%)",
  red: "hsl(0 100% 62%)",
  pink: "hsl(340 80% 55%)",
  orange: "hsl(25 100% 60%)",
}

export interface AudioSource {
  id: string
  name: string
  file?: File
  url: string
  /** Relative path inside project storage (e.g. "audio/recording-1.wav") */
  relativePath?: string
  duration: number
  /** @deprecated Use WaveformPeaks from waveform pipeline instead. */
  waveform?: number[]
  /** Status of waveform peak generation for this source. */
  waveformStatus?: import("./waveform").WaveformStatus
}

export type TimeStretchMode = "repitch" | "preserve"

export interface Clip {
  id: string
  trackId: string
  sourceId: string
  /** Timeline beat position where the clip starts */
  start: number
  /** Timeline beat position where the clip ends */
  end: number
  /** Offset inside source (beats) — how far into the source the visible window starts */
  offset: number
  name: string
  color?: string
  // ── Stretch / rate ──
  /** Playback rate multiplier (1 = normal, 2 = double speed, 0.5 = half speed) */
  playbackRate: number
  /** Whether pitch preservation is enabled during stretch */
  preservePitch: boolean
  /** Stretch algorithm hint for future TSM integration */
  timeStretchMode: TimeStretchMode
  // ── Fades ──
  /** Fade-in duration in beats */
  fadeInDuration: number
  /** Fade-out duration in beats */
  fadeOutDuration: number
  // ── Gain ──
  /** Per-clip gain multiplier (0–2, default 1) */
  gain: number
  // ── State flags ──
  locked: boolean
}

/** Default values for new clip fields — used when creating clips or migrating old data */
export const clipDefaults: Omit<Clip, "id" | "trackId" | "sourceId" | "start" | "end" | "offset" | "name"> = {
  playbackRate: 1,
  preservePitch: false,
  timeStretchMode: "repitch",
  fadeInDuration: 0,
  fadeOutDuration: 0,
  gain: 1,
  locked: false,
}

export type TimelineEditTool = "select" | "blade" | "slip"

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

// ── Master bus state ──

export interface MasterBusState {
  volume: number       // 0-100
}

export const defaultMasterBus: MasterBusState = {
  volume: 80,
}

// ── Session guardrails ──

/** Approximate max sources before a memory warning is shown */
export const MAX_SESSION_SOURCES = 50

/** Autosave interval in milliseconds (30 seconds) */
export const AUTOSAVE_INTERVAL_MS = 30_000

/** Shape of a serialised session stored in localStorage / IndexedDB */
export interface SessionSnapshot {
  projectId: string | null
  projectName: string
  bpm: number
  zoom: number
  loop: LoopRegion
  masterBus: MasterBusState
  tracks: StudioTrack[]
  clips: Clip[]
  mixerChannels: MixerChannel[]
  sources: Omit<AudioSource, "file">[]
  effects: EffectsState
  markers: TimelineMarker[]
  snapToGrid: boolean
  savedAt: number // Date.now()
}

// ── Default track presets for new sessions ──

export const defaultTrackPresets: { name: string; type: TrackType; color: string; armed: boolean; busId?: string }[] = [
  { name: "Beat", type: "beat", color: "hsl(217 100% 71%)", armed: false },
  { name: "Lead Vocal", type: "vocal", color: "hsl(142 60% 50%)", armed: true, busId: "__vocal_bus__" },
  { name: "Double", type: "vocal", color: "hsl(45 100% 60%)", armed: false, busId: "__vocal_bus__" },
  { name: "Ad-Lib", type: "vocal", color: "hsl(280 70% 60%)", armed: false, busId: "__vocal_bus__" },
]

// ── Undo / Redo snapshot ──

export interface UndoSnapshot {
  tracks: StudioTrack[]
  clips: Clip[]
  sources: AudioSource[]
  mixerChannels: MixerChannel[]
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
  isPaused: boolean
  bpm: number
  playhead: number
  zoom: number
  loop: LoopRegion
  tracks: StudioTrack[]
  clips: Clip[]
  sources: AudioSource[]
  mixerChannels: MixerChannel[]
  masterBus: MasterBusState
  selectedTrackId: string | null
  selectedClipId: string | null
  panels: StudioPanels
  effects: EffectsState
  markers: TimelineMarker[]
  snapToGrid: boolean
  trackLaneHeight: number   // pixels per track lane (40 = compact, 80 = standard, 120 = large)
  editTool: TimelineEditTool
  undoStack: UndoSnapshot[]
  redoStack: UndoSnapshot[]
  clipboard: Clip | null
  isDirty: boolean
  activeModal: ModalId
}

// ── Master FX state ──

export interface FXModuleState {
  active: boolean
  params: Record<string, number>
}

export interface EffectsState {
  compressor: FXModuleState
  delay: FXModuleState & { time: string }
  reverb: FXModuleState
  eq: FXModuleState
  pitchShifter: FXModuleState
  limiter: FXModuleState
  masterVolume: number
}

export const defaultEffects: EffectsState = {
  compressor: { active: true, params: { amount: 65 } },
  delay: { active: false, time: "1/4", params: { mix: 30 } },
  reverb: { active: true, params: { size: 45, mix: 40 } },
  eq: { active: true, params: { low: 50, mid: 55, high: 50 } },
  pitchShifter: { active: false, params: { semitones: 50 } },
  limiter: { active: true, params: { ceiling: 75, gain: 50 } },
  masterVolume: 80,
}
