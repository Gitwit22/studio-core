import * as Tone from "tone";

export function play() {
  Tone.getTransport().start();
}

export function stop() {
  Tone.getTransport().stop();
}

export function record() {
  Tone.getTransport().start();
}

export function setBPM(bpm: number) {
  Tone.getTransport().bpm.value = bpm;
}

export function getPosition(): string {
  return Tone.getTransport().position as string;
}
