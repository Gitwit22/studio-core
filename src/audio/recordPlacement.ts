export interface RecordPlacementInput {
  /** Playhead (beats) when the transport started for this take */
  transportStartBeat: number
  /** Context time (s) at which the transport started */
  transportStartTime: number
  /** Context time (s) of the first captured sample */
  firstFrameTime: number
  /** Length of the captured audio (s) */
  durationSec: number
  bpm: number
  /**
   * Round-trip latency to compensate (s): output latency (the performer hears
   * playback late) + input latency (their sound reaches us late) + any manual
   * calibration offset.
   */
  latencySec: number
}

export interface RecordPlacement {
  start: number
  end: number
  /** Offset into the source (beats): audio captured before the timeline position 0 is trimmed */
  offset: number
}

/**
 * Where a take belongs on the timeline. Captured audio at context time t lines
 * up with transport time (t − transportStartTime − latency) after the start
 * beat. Audio that would land before beat 0 is trimmed through the clip
 * offset (the source file itself is never altered).
 */
export function computeRecordPlacement(input: RecordPlacementInput): RecordPlacement {
  const beatsPerSec = input.bpm / 60
  const takeStartBeat =
    input.transportStartBeat +
    (input.firstFrameTime - input.transportStartTime - input.latencySec) * beatsPerSec
  const durationBeats = input.durationSec * beatsPerSec
  const trimBeats = Math.min(Math.max(0, -takeStartBeat), durationBeats)
  const start = Math.max(0, takeStartBeat)
  return { start, end: start + durationBeats - trimBeats, offset: trimBeats }
}
