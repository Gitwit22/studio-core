/* global AudioWorkletProcessor, registerProcessor, currentFrame */
/**
 * Raw capture: copies input samples into fixed-size chunks and hands each full
 * chunk to the main thread (transferred, not copied). Nothing else runs here —
 * no processing, no file I/O, no per-block allocation — so the audio thread
 * stays predictable. A new chunk buffer is allocated only when one is handed
 * off (every `chunkFrames` frames, ~85 ms at 48 kHz).
 *
 * Messages out: { type: "chunk", channels, frames, startFrame, peak, rms, clipped }
 *               { type: "done" } after a "stop" message has flushed the tail.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const opts = (options && options.processorOptions) || {}
    this.channelCount = (options && options.channelCount) || 1
    this.chunkFrames = opts.chunkFrames || 4096
    this.active = true
    this.allocate()
    this.port.onmessage = (event) => {
      if (event.data === "stop" && this.active) {
        this.flush()
        this.active = false
        this.port.postMessage({ type: "done" })
      }
    }
  }

  allocate() {
    this.buffers = []
    for (let ch = 0; ch < this.channelCount; ch++) this.buffers.push(new Float32Array(this.chunkFrames))
    this.fill = 0
    this.chunkStartFrame = -1
    this.peak = 0
    this.sumSquares = 0
    this.clipped = false
  }

  flush() {
    if (this.fill === 0) return
    const frames = this.fill
    const channels = this.buffers
    this.port.postMessage(
      {
        type: "chunk",
        channels,
        frames,
        startFrame: this.chunkStartFrame,
        peak: this.peak,
        rms: Math.sqrt(this.sumSquares / (frames * this.channelCount)),
        clipped: this.clipped,
      },
      channels.map((c) => c.buffer),
    )
    this.allocate()
  }

  process(inputs) {
    if (!this.active) return false
    const input = inputs[0]
    // No data yet (stream still starting) — stay alive and wait.
    if (!input || input.length === 0 || input[0].length === 0) return true

    const blockFrames = input[0].length
    let read = 0
    while (read < blockFrames) {
      if (this.chunkStartFrame < 0) this.chunkStartFrame = currentFrame + read
      const n = Math.min(blockFrames - read, this.chunkFrames - this.fill)
      for (let ch = 0; ch < this.channelCount; ch++) {
        const src = input[Math.min(ch, input.length - 1)]
        const dst = this.buffers[ch]
        for (let i = 0; i < n; i++) {
          const v = src[read + i]
          dst[this.fill + i] = v
          const a = v < 0 ? -v : v
          if (a > this.peak) this.peak = a
          if (a >= 0.999) this.clipped = true
          this.sumSquares += v * v
        }
      }
      this.fill += n
      read += n
      if (this.fill === this.chunkFrames) this.flush()
    }
    return true
  }
}

registerProcessor("studio-capture-processor", CaptureProcessor)
