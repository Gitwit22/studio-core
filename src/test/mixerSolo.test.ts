import { describe, it, expect, vi } from "vitest"
import { computeEffectiveMutes } from "@/audio/MixerEngine"
import type { MixerChannel, StudioTrack } from "@/studio/types/studio"

vi.mock("tone", () => ({}))

function track(id: string, busId?: string): StudioTrack {
  return {
    id, channelId: `ch-${id}`, name: id, type: busId === undefined && id === "bus" ? "bus" : "vocal",
    volume: 1, pan: 0, mute: false, solo: false, armed: false, order: 0, fxChain: [], busId,
  }
}
function channel(trackId: string, opts: Partial<MixerChannel> = {}): MixerChannel {
  return { id: `ch-${trackId}`, trackId, volume: 1, pan: 0, mute: false, solo: false, ...opts }
}

describe("computeEffectiveMutes", () => {
  const tracks = [track("bus"), track("lead", "bus"), track("double", "bus"), track("beat")]

  it("uses each channel's own mute when nothing is soloed", () => {
    const muted = computeEffectiveMutes(tracks, [
      channel("bus"), channel("lead", { mute: true }), channel("double"), channel("beat"),
    ])
    expect(Object.fromEntries(muted)).toEqual({ bus: false, lead: true, double: false, beat: false })
  })

  it("keeps the bus audible when a track routed to it is soloed", () => {
    const muted = computeEffectiveMutes(tracks, [
      channel("bus"), channel("lead", { solo: true }), channel("double"), channel("beat"),
    ])
    expect(Object.fromEntries(muted)).toEqual({ bus: false, lead: false, double: true, beat: true })
  })

  it("keeps tracks feeding a soloed bus audible", () => {
    const muted = computeEffectiveMutes(tracks, [
      channel("bus", { solo: true }), channel("lead"), channel("double"), channel("beat"),
    ])
    expect(Object.fromEntries(muted)).toEqual({ bus: false, lead: false, double: false, beat: true })
  })
})
