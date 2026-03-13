export class Recorder {
  mediaRecorder?: MediaRecorder;
  chunks: Blob[] = [];

  start(stream: MediaStream) {
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
        const blob = new Blob(this.chunks, { type: "audio/wav" });
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
