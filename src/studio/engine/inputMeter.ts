import { create } from "zustand"

/** Live input level of the track being recorded (transient UI state, never saved). */
interface InputMeterState {
  trackId: string | null
  /** Peak level 0–1 (linear) of the most recent capture chunk */
  peak: number
  /** Latched once any sample clips; cleared by the user */
  clipped: boolean
  update: (trackId: string, peak: number, clipped: boolean) => void
  clearClip: () => void
  reset: () => void
}

export const useInputMeter = create<InputMeterState>()((set) => ({
  trackId: null,
  peak: 0,
  clipped: false,
  update: (trackId, peak, clipped) =>
    set((s) => ({ trackId, peak, clipped: s.trackId === trackId ? s.clipped || clipped : clipped })),
  clearClip: () => set({ clipped: false }),
  reset: () => set({ trackId: null, peak: 0, clipped: false }),
}))

/** Linear peak → 0–1 meter position over a 60 dB range (same scale as track meters). */
export function peakToMeter(peak: number): number {
  if (peak <= 0) return 0
  const db = 20 * Math.log10(peak)
  return Math.max(0, Math.min(1, (db + 60) / 60))
}
