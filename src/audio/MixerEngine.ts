import * as Tone from "tone"
import { useStudioStore } from "@/studio/engine/studioStore"
import { audioEffectsManager } from "./AudioEffectsManager"
import type { TrackFXSlot, MixerChannel, StudioTrack } from "@/studio/types/studio"

/**
 * MixerEngine — per-track mixer strip with FX chain.
 *
 * Signal path per track:
 *   Player → Tone.Channel (vol / pan / mute) → Compressor → Delay → Reverb → EQ → Limiter → Meter → masterBus
 *
 * MixerChannel is the single source of truth for volume / pan / mute / solo.
 * Track.fxChain is the source of truth for per-track FX params & enable state.
 */

interface TrackFXNodes {
  compressor: Tone.Compressor
  delay: Tone.FeedbackDelay
  reverb: Tone.Reverb
  eq: Tone.EQ3
  pitchShifter: Tone.PitchShift
  limiter: Tone.Limiter
}

interface MixerStrip {
  channel: Tone.Channel
  fx: TrackFXNodes
  meter: Tone.Meter
}

class MixerEngine {
  private strips = new Map<string, MixerStrip>()
  private unsubscribe?: () => void
  private initialized = false

  /** Call after audioEffectsManager.init() */
  init() {
    if (this.initialized) return
    this.initialized = true

    const state = useStudioStore.getState()
    for (const track of state.tracks) {
      const ch = state.mixerChannels.find((c) => c.id === track.channelId)
      if (ch) this.ensureStrip(track, ch)
    }
    this.applySolo(state.mixerChannels)

    // Subscribe to store changes
    this.unsubscribe = useStudioStore.subscribe((curr, prev) => {
      if (curr.tracks !== prev.tracks || curr.mixerChannels !== prev.mixerChannels) {
        this.syncTracks(curr.tracks, curr.mixerChannels)
      }
    })
  }

  /** Get the Tone.Channel for a track — players connect here */
  getInput(trackId: string): Tone.Channel | undefined {
    return this.strips.get(trackId)?.channel
  }

  /** Read current level (0-1 normalized) for a track's meter */
  getLevel(trackId: string): number {
    const strip = this.strips.get(trackId)
    if (!strip) return 0
    const db = strip.meter.getValue() as number
    if (db <= -60) return 0
    if (db >= 0) return 1
    return (db + 60) / 60
  }

  /** Tear down everything */
  dispose() {
    this.unsubscribe?.()
    for (const [, strip] of this.strips) {
      this.disposeStrip(strip)
    }
    this.strips.clear()
    this.initialized = false
  }

  // ── Internal ──

  private createFXNodes(fxChain: TrackFXSlot[]): TrackFXNodes {
    const comp = fxChain.find((f) => f.type === "compressor")
    const del = fxChain.find((f) => f.type === "delay")
    const rev = fxChain.find((f) => f.type === "reverb")
    const eqSlot = fxChain.find((f) => f.type === "eq")
    const pitch = fxChain.find((f) => f.type === "pitchShifter")
    const lim = fxChain.find((f) => f.type === "limiter")

    const compressor = new Tone.Compressor({
      threshold: this.mapAmount(Number(comp?.params.amount ?? 65)),
      ratio: comp?.enabled ? 3 : 1,
    })

    const delay = new Tone.FeedbackDelay({
      delayTime: this.mapDelayTime(String(del?.params.time ?? "1/4")),
      feedback: 0.3,
      wet: del?.enabled ? Number(del.params.mix ?? 30) / 100 : 0,
    })

    const reverb = new Tone.Reverb({
      decay: this.mapReverbSize(Number(rev?.params.size ?? 45)),
      wet: rev?.enabled ? Number(rev.params.mix ?? 40) / 100 : 0,
    })

    const eq = new Tone.EQ3({
      low: eqSlot?.enabled ? this.mapEqGain(Number(eqSlot.params.low ?? 50)) : 0,
      mid: eqSlot?.enabled ? this.mapEqGain(Number(eqSlot.params.mid ?? 55)) : 0,
      high: eqSlot?.enabled ? this.mapEqGain(Number(eqSlot.params.high ?? 50)) : 0,
    })

    const pitchShifter = new Tone.PitchShift({
      pitch: this.mapPitchSemitones(Number(pitch?.params.semitones ?? 50)),
      wet: pitch?.enabled ? 1 : 0,
    })

    const limiter = new Tone.Limiter(
      lim?.enabled ? this.mapLimiterCeiling(Number(lim.params.ceiling ?? 75)) : 0,
    )

    // Wire: compressor → delay → reverb → eq → pitchShifter → limiter
    compressor.connect(delay)
    delay.connect(reverb)
    reverb.connect(eq)
    eq.connect(pitchShifter)
    pitchShifter.connect(limiter)

    return { compressor, delay, reverb, eq, pitchShifter, limiter }
  }

  private ensureStrip(track: StudioTrack, ch: MixerChannel) {
    if (this.strips.has(track.id)) return

    const channel = new Tone.Channel({
      volume: this.linearToDb(ch.volume),
      pan: ch.pan,
      mute: ch.mute,
    })

    const fx = this.createFXNodes(track.fxChain)
    const meter = new Tone.Meter({ smoothing: 0.8 })

    // Wire: channel → compressor → ... → limiter → meter → master bus
    channel.connect(fx.compressor)
    fx.limiter.connect(meter)

    if (audioEffectsManager.input) {
      meter.connect(audioEffectsManager.input)
    } else {
      meter.toDestination()
    }

    this.strips.set(track.id, { channel, fx, meter })
  }

  private disposeStrip(strip: MixerStrip) {
    strip.channel.dispose()
    strip.fx.compressor.dispose()
    strip.fx.delay.dispose()
    strip.fx.reverb.dispose()
    strip.fx.eq.dispose()
    strip.fx.pitchShifter.dispose()
    strip.fx.limiter.dispose()
    strip.meter.dispose()
  }

  private removeStrip(trackId: string) {
    const strip = this.strips.get(trackId)
    if (!strip) return
    this.disposeStrip(strip)
    this.strips.delete(trackId)
  }

  private syncTracks(tracks: StudioTrack[], channels: MixerChannel[]) {
    const trackIds = new Set(tracks.map((t) => t.id))

    // Remove strips for deleted tracks
    for (const id of this.strips.keys()) {
      if (!trackIds.has(id)) this.removeStrip(id)
    }

    // Add or update strips
    for (const track of tracks) {
      const ch = channels.find((c) => c.id === track.channelId)
      if (!ch) continue

      this.ensureStrip(track, ch)
      const strip = this.strips.get(track.id)!

      // Update channel from mixer channel state
      strip.channel.volume.value = this.linearToDb(ch.volume)
      strip.channel.pan.value = ch.pan

      // Sync per-track FX params
      this.syncFX(strip.fx, track.fxChain)

      // Handle bus routing: reconnect meter output to bus channel or master
      this.routeTrack(track, tracks)
    }

    this.applySolo(channels)
  }

  /** Route a track's output to its bus (if assigned) or to master effects chain */
  private routeTrack(track: StudioTrack, allTracks: StudioTrack[]) {
    const strip = this.strips.get(track.id)
    if (!strip) return

    // Disconnect meter from all destinations first
    strip.meter.disconnect()

    if (track.busId) {
      // Route to the bus track's channel input
      const busStrip = this.strips.get(track.busId)
      if (busStrip) {
        strip.meter.connect(busStrip.channel)
        return
      }
    }

    // Default: route to master effects chain or destination
    if (audioEffectsManager.input) {
      strip.meter.connect(audioEffectsManager.input)
    } else {
      strip.meter.toDestination()
    }
  }

  private syncFX(fx: TrackFXNodes, fxChain: TrackFXSlot[]) {
    for (const slot of fxChain) {
      switch (slot.type) {
        case "compressor":
          fx.compressor.threshold.value = this.mapAmount(Number(slot.params.amount ?? 65))
          fx.compressor.ratio.value = slot.enabled ? 3 : 1
          if (!slot.enabled) fx.compressor.threshold.value = 0
          break
        case "delay":
          fx.delay.delayTime.value = this.mapDelayTime(String(slot.params.time ?? "1/4"))
          fx.delay.wet.value = slot.enabled ? Number(slot.params.mix ?? 30) / 100 : 0
          break
        case "reverb":
          fx.reverb.decay = this.mapReverbSize(Number(slot.params.size ?? 45))
          fx.reverb.wet.value = slot.enabled ? Number(slot.params.mix ?? 40) / 100 : 0
          break
        case "eq":
          if (slot.enabled) {
            fx.eq.low.value = this.mapEqGain(Number(slot.params.low ?? 50))
            fx.eq.mid.value = this.mapEqGain(Number(slot.params.mid ?? 55))
            fx.eq.high.value = this.mapEqGain(Number(slot.params.high ?? 50))
          } else {
            fx.eq.low.value = 0
            fx.eq.mid.value = 0
            fx.eq.high.value = 0
          }
          break
        case "limiter":
          fx.limiter.threshold.value = slot.enabled
            ? this.mapLimiterCeiling(Number(slot.params.ceiling ?? 75))
            : 0
          break
        case "pitchShifter":
          fx.pitchShifter.pitch = this.mapPitchSemitones(Number(slot.params.semitones ?? 50))
          fx.pitchShifter.wet.value = slot.enabled ? 1 : 0
          break
      }
    }
  }

  /** Solo logic: if any channel has solo=true, mute all non-soloed. */
  private applySolo(channels: MixerChannel[]) {
    const anySolo = channels.some((c) => c.solo)
    for (const ch of channels) {
      const strip = this.strips.get(ch.trackId)
      if (!strip) continue
      strip.channel.mute = anySolo ? !ch.solo : ch.mute
    }
  }

  /** 0-1 linear volume → dB (clamp to -60 dB min) */
  private linearToDb(v: number): number {
    if (v <= 0) return -Infinity
    return 20 * Math.log10(v)
  }

  // ── Mapping helpers ──
  private mapAmount(v: number): number { return -60 + (v / 100) * 60 }
  private mapDelayTime(t: string): string {
    const map: Record<string, string> = { "1/4": "4n", "1/8": "8n", "1/16": "16n" }
    return map[t] ?? "8n"
  }
  private mapReverbSize(v: number): number { return 0.1 + (v / 100) * 9.9 }
  private mapEqGain(v: number): number { return ((v - 50) / 50) * 12 }
  private mapPitchSemitones(v: number): number { return ((v - 50) / 50) * 12 }
  private mapLimiterCeiling(v: number): number { return -30 + (v / 100) * 30 }
}

export const mixerEngine = new MixerEngine()
