import * as Tone from "tone";

/**
 * Render offline. `setupGraph` may be async (Tone awaits it before rendering),
 * which lets it load audio buffers before scheduling players.
 * `sampleRate` defaults to the live context's rate.
 */
export async function exportMix(
  duration: number,
  setupGraph: () => void | Promise<void>,
  sampleRate?: number,
): Promise<Tone.ToneAudioBuffer> {
  const buffer = await Tone.Offline(async () => {
    await setupGraph();
  }, duration, 2, sampleRate);

  return buffer;
}

export type WavBitDepth = 16 | 24 | 32;

/**
 * Encode as WAV. 16/24-bit are integer PCM; 32-bit is IEEE float (format 3).
 */
export function bufferToWav(buffer: Tone.ToneAudioBuffer | AudioBuffer, bitDepth: WavBitDepth = 16): Blob {
  const audioBuffer = "get" in buffer ? buffer.get() : buffer;
  if (!audioBuffer) {
    return new Blob([], { type: "audio/wav" });
  }

  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, headerSize + dataSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // 3 = IEEE float, 1 = PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channel data
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numberOfChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  let offset = headerSize;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      if (bitDepth === 32) {
        view.setFloat32(offset, sample, true);
      } else if (bitDepth === 24) {
        const int = Math.round(sample < 0 ? sample * 0x800000 : sample * 0x7fffff);
        view.setUint8(offset, int & 0xff);
        view.setUint8(offset + 1, (int >> 8) & 0xff);
        view.setUint8(offset + 2, (int >> 16) & 0xff);
      } else {
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
      }
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/** Scale so the loudest sample peaks at -0.1 dBFS. Silent buffers are left alone. */
export function normalizeBuffer(buffer: AudioBuffer, targetPeak = 0.989): void {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }
  if (peak === 0) return;
  const gain = targetPeak / peak;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
