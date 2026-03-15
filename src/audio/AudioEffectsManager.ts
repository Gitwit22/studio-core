import * as Tone from "tone"
import { useStudioStore } from "@/studio/engine/studioStore"
import type { EffectsState } from "@/studio/types/studio"

/**
 * AudioEffectsManager — singleton that holds live Tone.js effect nodes
 * and subscribes to the Zustand store so that any knob movement is
 * instantly reflected in the audio graph.
 *
 * Signal chain:  input → compressor → delay → reverb → eq → limiter → masterGain → destination
 * Recording path: mic → dry capture (no FX baked in)
 * Monitor path:   mic → FX chain → headphones (live polish)
 */

class AudioEffectsManager {
  // Tone.js nodes
  compressor!: Tone.Compressor
  delay!: Tone.FeedbackDelay
  reverb!: Tone.Reverb
  eq!: Tone.EQ3
  limiter!: Tone.Limiter
  masterGain!: Tone.Gain
  meter!: Tone.Meter

  private initialized = false
  private unsubscribe?: () => void

  /** Must be called after audioEngine.init() */
  init() {
    if (this.initialized) return
    this.initialized = true

    const state = useStudioStore.getState()

    // Create nodes with initial store values
    this.compressor = new Tone.Compressor({
      threshold: this.mapAmount(state.effects.compressor.params.amount),
      ratio: 3,
    })

    this.delay = new Tone.FeedbackDelay({
      delayTime: this.mapDelayTime(state.effects.delay.time),
      feedback: 0.3,
      wet: state.effects.delay.params.mix / 100,
    })

    this.reverb = new Tone.Reverb({
      decay: this.mapReverbSize(state.effects.reverb.params.size),
      wet: state.effects.reverb.params.mix / 100,
    })

    this.eq = new Tone.EQ3({
      low: this.mapEqGain(state.effects.eq.params.low),
      mid: this.mapEqGain(state.effects.eq.params.mid),
      high: this.mapEqGain(state.effects.eq.params.high),
    })

    this.limiter = new Tone.Limiter(
      this.mapLimiterCeiling(state.effects.limiter.params.ceiling),
    )

    this.masterGain = new Tone.Gain(state.effects.masterVolume / 100)
    this.meter = new Tone.Meter()

    // Wire chain: compressor → delay → reverb → eq → limiter → masterGain → meter → destination
    this.compressor.connect(this.delay)
    this.delay.connect(this.reverb)
    this.reverb.connect(this.eq)
    this.eq.connect(this.limiter)
    this.limiter.connect(this.masterGain)
    this.masterGain.connect(this.meter)
    this.meter.toDestination()

    // Apply active/bypass state
    this.applyBypass(state.effects)

    // Subscribe to future store changes
    this.unsubscribe = useStudioStore.subscribe(
      (curr, prev) => {
        if (curr.effects !== prev.effects) {
          this.syncFromStore(curr.effects)
        }
      },
    )
  }

  /** The node that audio sources should connect to */
  get input(): Tone.Compressor {
    return this.compressor
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
    this.compressor.dispose()
    this.delay.dispose()
    this.reverb.dispose()
    this.eq.dispose()
    this.limiter.dispose()
    this.masterGain.dispose()
    this.meter.dispose()
    this.initialized = false
  }

  // ── Internal mapping helpers ──

  private syncFromStore(fx: EffectsState) {
    // Compressor
    this.compressor.threshold.value = this.mapAmount(fx.compressor.params.amount)

    // Delay
    this.delay.delayTime.value = this.mapDelayTime(fx.delay.time)
    this.delay.wet.value = fx.delay.params.mix / 100

    // Reverb
    this.reverb.decay = this.mapReverbSize(fx.reverb.params.size)
    this.reverb.wet.value = fx.reverb.params.mix / 100

    // EQ
    this.eq.low.value = this.mapEqGain(fx.eq.params.low)
    this.eq.mid.value = this.mapEqGain(fx.eq.params.mid)
    this.eq.high.value = this.mapEqGain(fx.eq.params.high)

    // Limiter
    this.limiter.threshold.value = this.mapLimiterCeiling(fx.limiter.params.ceiling)

    // Master
    this.masterGain.gain.value = fx.masterVolume / 100

    // Bypass
    this.applyBypass(fx)
  }

  private applyBypass(fx: EffectsState) {
    this.compressor.wet.value = fx.compressor.active ? 1 : 0
    this.delay.wet.value = fx.delay.active ? fx.delay.params.mix / 100 : 0
    this.reverb.wet.value = fx.reverb.active ? fx.reverb.params.mix / 100 : 0
    // EQ bypass: set all bands to 0 dB
    if (!fx.eq.active) {
      this.eq.low.value = 0
      this.eq.mid.value = 0
      this.eq.high.value = 0
    }
    // Limiter: raise threshold to effectively bypass
    if (!fx.limiter.active) {
      this.limiter.threshold.value = 0
    }
  }

  // Knob (0-100) → threshold (-60 to 0 dB)
  private mapAmount(v: number): number {
    return -60 + (v / 100) * 60
  }

  // "1/4" | "1/8" | "1/16" → Tone delay time notation
  private mapDelayTime(t: string): string {
    const map: Record<string, string> = { "1/4": "4n", "1/8": "8n", "1/16": "16n" }
    return map[t] ?? "8n"
  }

  // 0-100 → 0.1 to 10 seconds
  private mapReverbSize(v: number): number {
    return 0.1 + (v / 100) * 9.9
  }

  // 0-100 → -12 to +12 dB (50 = 0 dB)
  private mapEqGain(v: number): number {
    return ((v - 50) / 50) * 12
  }

  // 0-100 → -30 to 0 dB
  private mapLimiterCeiling(v: number): number {
    return -30 + (v / 100) * 30
  }
}

export const audioEffectsManager = new AudioEffectsManager()
