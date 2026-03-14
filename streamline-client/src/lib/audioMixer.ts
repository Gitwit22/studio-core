/**
 * Audio Mixer Engine
 *
 * Bus-based mixer model using the Web Audio API.
 *
 * Buses:
 *   guestBus        – all remote participant mic tracks
 *   localMicBus     – host microphone
 *   screenShareBus  – screen-share audio tracks
 *   musicBus        – uploaded / selected MP3 playback
 *   masterBus       – final program output
 *
 * Each bus exposes: gain, mute, solo, ducking priority,
 * and target-output flags (monitor / program).
 *
 * Two outputs:
 *   monitor  – what the producer hears locally
 *   program  – what goes to stream / recording / viewers
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BusId =
  | "guestBus"
  | "localMicBus"
  | "screenShareBus"
  | "musicBus"
  | "masterBus";

/** Which output(s) this bus feeds into. */
export interface OutputFlags {
  monitor: boolean;
  program: boolean;
}

/** Per-bus state that the UI reads / writes. */
export interface BusState {
  gain: number;          // 0 – 1 (linear)
  muted: boolean;
  solo: boolean;
  duckingPriority: number; // 0 = no ducking, higher = higher priority
  outputs: OutputFlags;
}

/** Complete mixer snapshot the UI can subscribe to. */
export interface MixerState {
  buses: Record<BusId, BusState>;
  monitorGain: number;   // 0 – 1
  programGain: number;   // 0 – 1
}

export type MixerListener = (state: MixerState) => void;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_BUS_STATE: Record<BusId, BusState> = {
  guestBus: {
    gain: 0.8,
    muted: false,
    solo: false,
    duckingPriority: 0,
    outputs: { monitor: true, program: true },
  },
  localMicBus: {
    gain: 1.0,
    muted: false,
    solo: false,
    duckingPriority: 2,
    outputs: { monitor: true, program: true },
  },
  screenShareBus: {
    gain: 0.7,
    muted: false,
    solo: false,
    duckingPriority: 0,
    outputs: { monitor: true, program: true },
  },
  musicBus: {
    gain: 0.5,
    muted: false,
    solo: false,
    duckingPriority: 0,
    outputs: { monitor: true, program: false },
  },
  masterBus: {
    gain: 1.0,
    muted: false,
    solo: false,
    duckingPriority: 0,
    outputs: { monitor: true, program: true },
  },
};

// ---------------------------------------------------------------------------
// Human-readable labels
// ---------------------------------------------------------------------------

export const BUS_LABELS: Record<BusId, string> = {
  guestBus: "Guests",
  localMicBus: "Host Mic",
  screenShareBus: "Screen Share",
  musicBus: "Music",
  masterBus: "Master",
};

export const ALL_BUS_IDS: BusId[] = [
  "localMicBus",
  "guestBus",
  "screenShareBus",
  "musicBus",
  "masterBus",
];

// ---------------------------------------------------------------------------
// AudioMixer class
// ---------------------------------------------------------------------------

/**
 * Client-side audio mixer built on the Web Audio API.
 *
 * Usage:
 *   const mixer = new AudioMixer();
 *   mixer.subscribe(state => { … });
 *   mixer.setGain("musicBus", 0.6);
 *   mixer.connectSource("guestBus", mediaStream);
 */
export class AudioMixer {
  private ctx: AudioContext | null = null;

  // Per-bus Web Audio nodes
  private gainNodes = new Map<BusId, GainNode>();

  // Output buses
  private monitorGain: GainNode | null = null;
  private programGain: GainNode | null = null;

  // Source connections (so we can disconnect)
  private sources = new Map<string, MediaStreamAudioSourceNode>();

  // State & listeners
  private state: MixerState;
  private listeners = new Set<MixerListener>();

  constructor() {
    this.state = {
      buses: structuredClone(DEFAULT_BUS_STATE),
      monitorGain: 1.0,
      programGain: 1.0,
    };
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  /** Call once after a user gesture to create the AudioContext. */
  init(): void {
    if (this.ctx) return;

    this.ctx = new AudioContext();

    // Create output gain nodes
    this.monitorGain = this.ctx.createGain();
    this.monitorGain.connect(this.ctx.destination); // monitor → speakers

    this.programGain = this.ctx.createGain();
    // programGain is *not* connected to destination – the consumer can
    // grab programGain.stream via createMediaStreamDestination if needed.

    // Create per-bus gain nodes and wire them to the outputs
    for (const busId of ALL_BUS_IDS) {
      const node = this.ctx.createGain();
      this.gainNodes.set(busId, node);
      this.applyBusRouting(busId);
    }

    this.applyAllGains();
  }

  /** Tear down the AudioContext and disconnect everything. */
  destroy(): void {
    for (const src of this.sources.values()) {
      try { src.disconnect(); } catch { /* already disconnected */ }
    }
    this.sources.clear();

    if (this.ctx && this.ctx.state !== "closed") {
      void this.ctx.close();
    }
    this.ctx = null;
    this.gainNodes.clear();
    this.monitorGain = null;
    this.programGain = null;
  }

  // -----------------------------------------------------------------------
  // Source management
  // -----------------------------------------------------------------------

  /**
   * Connect a MediaStream (e.g. a remote participant track) to a bus.
   * `key` should be a unique id for this source (e.g. participant id).
   */
  connectSource(busId: BusId, key: string, stream: MediaStream): void {
    if (!this.ctx) return;

    // Disconnect previous source with same key
    this.disconnectSource(key);

    const source = this.ctx.createMediaStreamSource(stream);
    const busNode = this.gainNodes.get(busId);
    if (busNode) source.connect(busNode);
    this.sources.set(key, source);
  }

  /** Disconnect a previously connected source by key. */
  disconnectSource(key: string): void {
    const existing = this.sources.get(key);
    if (existing) {
      try { existing.disconnect(); } catch { /* ok */ }
      this.sources.delete(key);
    }
  }

  // -----------------------------------------------------------------------
  // State mutations
  // -----------------------------------------------------------------------

  setGain(busId: BusId, value: number): void {
    this.state.buses[busId].gain = Math.max(0, Math.min(1, value));
    this.applyBusGain(busId);
    this.notify();
  }

  setMuted(busId: BusId, muted: boolean): void {
    this.state.buses[busId].muted = muted;
    this.applyBusGain(busId);
    this.notify();
  }

  setSolo(busId: BusId, solo: boolean): void {
    this.state.buses[busId].solo = solo;
    this.applyAllGains(); // solo affects all buses
    this.notify();
  }

  setDuckingPriority(busId: BusId, priority: number): void {
    this.state.buses[busId].duckingPriority = priority;
    this.notify();
  }

  setOutputFlag(busId: BusId, output: keyof OutputFlags, enabled: boolean): void {
    this.state.buses[busId].outputs[output] = enabled;
    this.applyBusRouting(busId);
    this.notify();
  }

  setMonitorGain(value: number): void {
    this.state.monitorGain = Math.max(0, Math.min(1, value));
    if (this.monitorGain) this.monitorGain.gain.value = this.state.monitorGain;
    this.notify();
  }

  setProgramGain(value: number): void {
    this.state.programGain = Math.max(0, Math.min(1, value));
    if (this.programGain) this.programGain.gain.value = this.state.programGain;
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscriptions
  // -----------------------------------------------------------------------

  subscribe(fn: MixerListener): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => { this.listeners.delete(fn); };
  }

  getState(): MixerState {
    return structuredClone(this.state);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private notify(): void {
    const snapshot = this.getState();
    for (const fn of this.listeners) fn(snapshot);
  }

  /** Compute the effective gain for a bus, honouring mute & solo. */
  private effectiveGain(busId: BusId): number {
    const bus = this.state.buses[busId];
    if (bus.muted) return 0;

    // If any bus has solo enabled, only solo'd buses are audible
    const anySolo = ALL_BUS_IDS.some((id) => this.state.buses[id].solo);
    if (anySolo && !bus.solo) return 0;

    return bus.gain;
  }

  private applyBusGain(busId: BusId): void {
    const node = this.gainNodes.get(busId);
    if (node) node.gain.value = this.effectiveGain(busId);
  }

  private applyAllGains(): void {
    for (const busId of ALL_BUS_IDS) this.applyBusGain(busId);
  }

  /** (Re-)connect a bus node to the appropriate output nodes. */
  private applyBusRouting(busId: BusId): void {
    const node = this.gainNodes.get(busId);
    if (!node) return;

    // Disconnect from everything first
    try { node.disconnect(); } catch { /* nothing connected yet */ }

    const flags = this.state.buses[busId].outputs;
    if (flags.monitor && this.monitorGain) node.connect(this.monitorGain);
    if (flags.program && this.programGain) node.connect(this.programGain);
  }
}
