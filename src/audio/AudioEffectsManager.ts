import * as Tone from "tone"
import { useStudioStore } from "@/studio/engine/studioStore"

/**
 * AudioEffectsManager — master bus only.
 *
 * Signal chain:  mixer strips → masterGain → masterLimiter → masterMeter → destination
 *
 * Per-track FX are now handled by MixerEngine.
 */

class AudioEffectsManager {
  masterGain!: Tone.Gain
  masterLimiter!: Tone.Limiter
  meter!: Tone.Meter

  private initialized = false
  private unsubscribe?: () => void

  /** Must be called before mixerEngine.init() */
  init() {
    if (this.initialized) return
    this.initialized = true

    const state = useStudioStore.getState()

    this.masterGain = new Tone.Gain(state.masterBus.volume / 100)
    this.masterLimiter = new Tone.Limiter(-1)
    this.meter = new Tone.Meter()

    // Wire: masterGain → masterLimiter → meter → destination
    this.masterGain.connect(this.masterLimiter)
    this.masterLimiter.connect(this.meter)
    this.meter.toDestination()

    // Subscribe to master bus changes
    this.unsubscribe = useStudioStore.subscribe((curr, prev) => {
      if (curr.masterBus !== prev.masterBus) {
        this.masterGain.gain.value = curr.masterBus.volume / 100
      }
    })
  }

  /** The node that mixer strip outputs should connect to */
  get input(): Tone.Gain {
    return this.masterGain
  }

  /** Read current master meter level (dB) */
  getLevel(): number {
    if (!this.initialized) return -Infinity
    return this.meter.getValue() as number
  }

  /** Tear down nodes and unsubscribe */
  dispose() {
    this.unsubscribe?.()
    if (!this.initialized) return
    this.masterGain.dispose()
    this.masterLimiter.dispose()
    this.meter.dispose()
    this.initialized = false
  }
}

export const audioEffectsManager = new AudioEffectsManager()
