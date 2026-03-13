import * as Tone from "tone";

class AudioEngine {
  contextStarted = false;

  async init() {
    if (!this.contextStarted) {
      await Tone.start();
      this.contextStarted = true;
    }
  }

  reset() {
    this.contextStarted = false;
  }
}

export const audioEngine = new AudioEngine();
