import * as Tone from "tone"
import captureProcessorUrl from "./worklets/capture-processor.js?url"

export interface PcmChunk {
  channels: Float32Array[]
  frames: number
  /** Context frame index of the chunk's first sample */
  startFrame: number
  peak: number
  rms: number
  clipped: boolean
}

export interface PcmTake {
  channels: Float32Array[]
  frames: number
  sampleRate: number
  /** Context time (seconds) of the first captured sample */
  firstFrameTime: number
  clipped: boolean
}

type ToneContext = ReturnType<typeof Tone.getContext>

// Tone caches a single worklet module per context (its own), so ours is loaded
// directly on the raw context and tracked here.
const loadedModules = new WeakMap<object, Promise<void>>()

function loadCaptureModule(ctx: ToneContext): Promise<void> {
  const raw = ctx.rawContext as unknown as { audioWorklet?: { addModule(url: string): Promise<void> } }
  if (!raw.audioWorklet) return Promise.reject(new Error("AudioWorklet is not available"))
  let promise = loadedModules.get(raw)
  if (!promise) {
    promise = raw.audioWorklet.addModule(captureProcessorUrl)
    loadedModules.set(raw, promise)
    promise.catch(() => loadedModules.delete(raw))
  }
  return promise
}

/**
 * Lossless recorder: MediaStream → capture worklet → Float32 chunks.
 * The worklet's output goes to a muted gain so the browser keeps processing it
 * without it ever being heard. Nothing in this path alters the samples.
 */
export class PcmRecorder {
  static isSupported(): boolean {
    return typeof AudioWorkletNode !== "undefined" && typeof window !== "undefined" && window.isSecureContext
  }

  private node: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private sink: GainNode | null = null
  private chunks: PcmChunk[] = []
  private sampleRate = 0
  private clipped = false
  private doneResolver: (() => void) | null = null

  /** The live input node, for an optional monitoring branch. */
  get inputNode(): MediaStreamAudioSourceNode | null {
    return this.source
  }

  async start(stream: MediaStream, channelCount: number, onChunk?: (chunk: PcmChunk) => void): Promise<void> {
    const ctx = Tone.getContext()
    await loadCaptureModule(ctx)
    const raw = ctx.rawContext as unknown as AudioContext
    this.sampleRate = raw.sampleRate
    this.chunks = []
    this.clipped = false

    this.source = ctx.createMediaStreamSource(stream)
    this.node = ctx.createAudioWorkletNode("studio-capture-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount,
      // Mono capture down-mixes a stereo device; stereo capture up-mixes a mono mic.
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      processorOptions: { chunkFrames: 4096 },
    })
    this.sink = raw.createGain()
    this.sink.gain.value = 0

    this.node.port.onmessage = (event: MessageEvent) => {
      const msg = event.data
      if (msg.type === "chunk") {
        const chunk = msg as PcmChunk
        this.chunks.push(chunk)
        if (chunk.clipped) this.clipped = true
        onChunk?.(chunk)
      } else if (msg.type === "done") {
        this.doneResolver?.()
      }
    }

    this.source.connect(this.node)
    this.node.connect(this.sink)
    this.sink.connect(raw.destination)
  }

  /** Flush the worklet, tear down the graph and return the full take. */
  async stop(): Promise<PcmTake> {
    const node = this.node
    if (!node) throw new Error("Recorder was not started")
    await new Promise<void>((resolve) => {
      this.doneResolver = resolve
      node.port.postMessage("stop")
      // Never hang if the audio thread is gone (e.g. context closed)
      setTimeout(resolve, 2000)
    })
    this.doneResolver = null
    try { this.source?.disconnect() } catch { /* already disconnected */ }
    try { node.disconnect() } catch { /* already disconnected */ }
    try { this.sink?.disconnect() } catch { /* already disconnected */ }
    this.node = null
    this.source = null
    this.sink = null

    const take = assembleChunks(this.chunks, this.sampleRate)
    this.chunks = []
    return { ...take, clipped: this.clipped }
  }
}

/** Concatenate chunks into contiguous channel arrays. */
export function assembleChunks(
  chunks: Pick<PcmChunk, "channels" | "frames" | "startFrame">[],
  sampleRate: number,
): Omit<PcmTake, "clipped"> {
  const channelCount = chunks[0]?.channels.length ?? 1
  const frames = chunks.reduce((sum, c) => sum + c.frames, 0)
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames))
  let offset = 0
  for (const chunk of chunks) {
    for (let ch = 0; ch < channelCount; ch++) {
      channels[ch].set(chunk.channels[ch].subarray(0, chunk.frames), offset)
    }
    offset += chunk.frames
  }
  const firstFrame = chunks[0]?.startFrame ?? 0
  return { channels, frames, sampleRate, firstFrameTime: sampleRate ? firstFrame / sampleRate : 0 }
}
