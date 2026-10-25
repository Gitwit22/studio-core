import * as Tone from "tone";
import { getStudioSettings } from "@/studio/settings/studioSettings";

type SinkCapableContext = AudioContext & { setSinkId?: (sinkId: string) => Promise<void> };

/** Whether this browser can route Web Audio output to a chosen device (AudioContext.setSinkId). */
export const supportsOutputDeviceSelection =
  typeof AudioContext !== "undefined" && "setSinkId" in AudioContext.prototype;

class AudioEngine {
  contextStarted = false;

  async init() {
    if (!this.contextStarted) {
      await Tone.start();
      this.contextStarted = true;
      const { outputDeviceId } = getStudioSettings();
      if (outputDeviceId) {
        // A stale/unplugged device must not block playback — fall back to the default output.
        await this.setOutputDevice(outputDeviceId).catch((err) =>
          console.warn("Could not use saved output device:", err),
        );
      }
    }
  }

  /** Route playback to an output device (null = system default). Returns false if unsupported. */
  async setOutputDevice(deviceId: string | null): Promise<boolean> {
    if (!supportsOutputDeviceSelection) return false;
    const ctx = Tone.getContext().rawContext as SinkCapableContext;
    if (typeof ctx.setSinkId !== "function") return false;
    await ctx.setSinkId(deviceId ?? "");
    return true;
  }

  reset() {
    this.contextStarted = false;
  }
}

export const audioEngine = new AudioEngine();
