import * as Tone from "tone";
import { createEffectsChain, type EffectsChainNodes } from "./EffectsChain";

export class Track {
  name: string;
  player?: Tone.Player;
  gain: Tone.Gain;
  fx: EffectsChainNodes;

  constructor(name: string) {
    this.name = name;
    this.gain = new Tone.Gain(1).toDestination();
    this.fx = createEffectsChain(this.gain);
  }
}

export async function loadBeat(file: File): Promise<Tone.Player> {
  const url = URL.createObjectURL(file);
  const player = new Tone.Player(url).toDestination();
  player.sync().start(0);
  return player;
}

export const defaultTracks = [
  "Beat",
  "Lead Vocal",
  "Double",
  "AdLib",
] as const;

export type TrackName = (typeof defaultTracks)[number];

export function createDefaultTracks(): Track[] {
  return defaultTracks.map((name) => new Track(name));
}
