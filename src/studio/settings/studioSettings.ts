import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

/**
 * App-wide user preferences (not part of a session). Stored per browser in
 * localStorage; if storage is unavailable the defaults are used for the visit.
 */

/** "auto" keeps the original behaviour: clip moves snap to 1 beat, trims/splits to 1/4 beat. */
export type GridDivision = "auto" | "bar" | "beat" | "1/2" | "1/4" | "1/8" | "1/16"

export const gridDivisionOptions: { value: GridDivision; label: string }[] = [
  { value: "auto", label: "Auto (move 1 beat, trim 1/4)" },
  { value: "bar", label: "1 Bar" },
  { value: "beat", label: "1 Beat" },
  { value: "1/2", label: "1/2 Beat" },
  { value: "1/4", label: "1/4 Beat" },
  { value: "1/8", label: "1/8 Beat" },
  { value: "1/16", label: "1/16 Beat" },
]

export type AutosaveInterval = "off" | "15s" | "30s" | "1m" | "5m"

export const autosaveIntervalOptions: { value: AutosaveInterval; label: string; ms: number | null }[] = [
  { value: "off", label: "Off", ms: null },
  { value: "15s", label: "15 seconds", ms: 15_000 },
  { value: "30s", label: "30 seconds", ms: 30_000 },
  { value: "1m", label: "1 minute", ms: 60_000 },
  { value: "5m", label: "5 minutes", ms: 300_000 },
]

export interface StudioSettings {
  /** Mic used for recording when the armed track has no device of its own (null = browser default) */
  inputDeviceId: string | null
  /** Output device for playback (null = system default) */
  outputDeviceId: string | null
  metronome: boolean
  snapByDefault: boolean
  gridDivision: GridDivision
  autoScroll: boolean
  autosaveInterval: AutosaveInterval
  showTrackMeters: boolean
  showFXBadges: boolean
}

export const defaultStudioSettings: StudioSettings = {
  inputDeviceId: null,
  outputDeviceId: null,
  metronome: false,
  snapByDefault: true,
  gridDivision: "auto",
  autoScroll: true,
  autosaveInterval: "15s",
  showTrackMeters: true,
  showFXBadges: true,
}

interface StudioSettingsActions {
  updateSettings: (updates: Partial<StudioSettings>) => void
}

export const useStudioSettings = create<StudioSettings & StudioSettingsActions>()(
  persist(
    (set) => ({
      ...defaultStudioSettings,
      updateSettings: (updates) => set(updates),
    }),
    {
      name: "studio-core-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ updateSettings: _u, ...settings }) => settings,
    },
  ),
)

export function getStudioSettings(): StudioSettings {
  return useStudioSettings.getState()
}

export function autosaveIntervalMs(interval: AutosaveInterval = getStudioSettings().autosaveInterval): number | null {
  const option = autosaveIntervalOptions.find((o) => o.value === interval)
  return option ? option.ms : 15_000
}

const divisionBeats: Record<Exclude<GridDivision, "auto">, number> = {
  bar: 4,
  beat: 1,
  "1/2": 0.5,
  "1/4": 0.25,
  "1/8": 0.125,
  "1/16": 0.0625,
}

/**
 * Snap a beat position to the grid. `autoStep` is the step used when the
 * division is "auto" (1 for clip moves, 0.25 for trims and splits).
 */
export function snapBeat(beat: number, autoStep: number, division: GridDivision = getStudioSettings().gridDivision): number {
  const step = division === "auto" ? autoStep : divisionBeats[division]
  return Math.round(beat / step) * step
}
