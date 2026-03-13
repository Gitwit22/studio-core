import * as Tone from "tone";

class AudioEngine {
  contextStarted = false;

  async init() {
    if (!this.contextStarted) {
      await Tone.start();
      this.contextStarted = true;
      console.log("Audio engine ready");
    }
  }
}

export const audioEngine = new AudioEngine();
