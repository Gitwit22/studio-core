export class Recorder {
  mediaRecorder?: MediaRecorder;
  chunks: Blob[] = [];

  start(stream: MediaStream) {
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(stream);

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };

    this.mediaRecorder.start();
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new Blob([], { type: "audio/wav" }));
        return;
      }

      this.mediaRecorder.onstop = () => {
        // MediaRecorder emits a compressed container (webm/ogg/mp4), not WAV —
        // label the blob with what the browser actually produced.
        const type = this.mediaRecorder?.mimeType || this.chunks[0]?.type || "audio/webm";
        const blob = new Blob(this.chunks, { type });
        resolve(blob);
        this.chunks = [];
      };

      this.mediaRecorder.stop();
    });
  }
}

export interface Clip {
  id: string;
  track: string;
  start: number;
  duration: number;
  blob: Blob;
}
