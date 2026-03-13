import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Tone.js before importing modules
vi.mock("tone", () => ({
  start: vi.fn().mockResolvedValue(undefined),
  Gain: vi.fn().mockImplementation(() => ({
    toDestination: vi.fn().mockReturnThis(),
    connect: vi.fn(),
  })),
  Compressor: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    ratio: { value: 3 },
    threshold: { value: -24 },
  })),
  FeedbackDelay: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    delayTime: { value: "8n" },
  })),
  Reverb: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    wet: { value: 0.3 },
  })),
  Player: vi.fn().mockImplementation(() => ({
    toDestination: vi.fn().mockReturnThis(),
    sync: vi.fn().mockReturnValue({ start: vi.fn() }),
  })),
  getTransport: vi.fn().mockReturnValue({
    start: vi.fn(),
    stop: vi.fn(),
    bpm: { value: 120 },
    position: "0:0:0",
  }),
  Offline: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
  Meter: vi.fn().mockImplementation(() => ({
    getValue: vi.fn().mockReturnValue(-60),
    connect: vi.fn(),
  })),
  UserMedia: vi.fn().mockImplementation(() => ({
    open: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
  })),
}));

describe("AudioEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize the audio context", async () => {
    const { audioEngine } = await import("../audio/AudioEngine");
    audioEngine.reset();

    const Tone = await import("tone");
    await audioEngine.init();

    expect(audioEngine.contextStarted).toBe(true);
    expect(Tone.start).toHaveBeenCalledOnce();
  });

  it("should not re-initialize if already started", async () => {
    const { audioEngine } = await import("../audio/AudioEngine");
    // Ensure engine is started
    await audioEngine.init();

    const Tone = await import("tone");
    vi.mocked(Tone.start).mockClear();

    await audioEngine.init();

    expect(Tone.start).not.toHaveBeenCalled();
  });
});

describe("EffectsChain", () => {
  it("should create an effects chain with compressor, delay, and reverb", async () => {
    const Tone = await import("tone");
    const { createEffectsChain } = await import("../audio/EffectsChain");

    const mockGain = new Tone.Gain(1);
    const fx = createEffectsChain(mockGain);

    expect(fx.compressor).toBeDefined();
    expect(fx.delay).toBeDefined();
    expect(fx.reverb).toBeDefined();
  });

  it("should wire compressor → delay → reverb → destination", async () => {
    const Tone = await import("tone");
    const { createEffectsChain } = await import("../audio/EffectsChain");

    const mockGain = new Tone.Gain(1);
    createEffectsChain(mockGain);

    expect(Tone.Compressor).toHaveBeenCalledWith({
      threshold: -24,
      ratio: 3,
    });
    expect(Tone.FeedbackDelay).toHaveBeenCalledWith("8n", 0.3);
    expect(Tone.Reverb).toHaveBeenCalledWith({
      decay: 3,
      wet: 0.3,
    });
  });
});

describe("TrackManager", () => {
  it("should create a track with name and gain node", async () => {
    const { Track } = await import("../audio/TrackManager");
    const track = new Track("Beat");

    expect(track.name).toBe("Beat");
    expect(track.gain).toBeDefined();
    expect(track.fx).toBeDefined();
    expect(track.fx.compressor).toBeDefined();
    expect(track.fx.delay).toBeDefined();
    expect(track.fx.reverb).toBeDefined();
  });

  it("should create default tracks for Beat, Lead Vocal, Double, AdLib", async () => {
    const { createDefaultTracks, defaultTracks } = await import(
      "../audio/TrackManager"
    );

    expect(defaultTracks).toEqual(["Beat", "Lead Vocal", "Double", "AdLib"]);

    const tracks = createDefaultTracks();
    expect(tracks).toHaveLength(4);
    expect(tracks[0].name).toBe("Beat");
    expect(tracks[1].name).toBe("Lead Vocal");
    expect(tracks[2].name).toBe("Double");
    expect(tracks[3].name).toBe("AdLib");
  });
});

describe("TransportController", () => {
  it("should start transport on play", async () => {
    const Tone = await import("tone");
    const transport = Tone.getTransport();
    vi.mocked(transport.start).mockClear();

    const { play } = await import("../audio/TransportController");
    play();

    expect(transport.start).toHaveBeenCalledOnce();
  });

  it("should stop transport on stop", async () => {
    const Tone = await import("tone");
    const transport = Tone.getTransport();
    vi.mocked(transport.stop).mockClear();

    const { stop } = await import("../audio/TransportController");
    stop();

    expect(transport.stop).toHaveBeenCalledOnce();
  });

  it("should start transport on record", async () => {
    const Tone = await import("tone");
    const transport = Tone.getTransport();
    vi.mocked(transport.start).mockClear();

    const { startRecordTransport } = await import("../audio/TransportController");
    startRecordTransport();

    expect(transport.start).toHaveBeenCalledOnce();
  });

  it("should set BPM", async () => {
    const Tone = await import("tone");
    const transport = Tone.getTransport();

    const { setBPM } = await import("../audio/TransportController");
    setBPM(140);

    expect(transport.bpm.value).toBe(140);
  });
});

describe("Recorder", () => {
  it("should start and stop recording, returning a blob", async () => {
    const { Recorder } = await import("../audio/Recorder");
    const recorder = new Recorder();

    // Create a mock MediaStream
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([]),
    } as unknown as MediaStream;

    // Mock MediaRecorder
    let ondataavailable: ((e: { data: Blob }) => void) | null = null;
    let onstop: (() => void) | null = null;

    const mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockImplementation(() => {
        if (onstop) onstop();
      }),
      set ondataavailable(fn: (e: { data: Blob }) => void) {
        ondataavailable = fn;
      },
      set onstop(fn: () => void) {
        onstop = fn;
      },
    };

    vi.stubGlobal(
      "MediaRecorder",
      vi.fn().mockImplementation(() => mockMediaRecorder)
    );

    recorder.start(mockStream);
    expect(mockMediaRecorder.start).toHaveBeenCalled();

    // Simulate data being available
    if (ondataavailable) {
      ondataavailable({ data: new Blob(["test"], { type: "audio/wav" }) });
    }

    const blob = await recorder.stop();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/wav");
  });

  it("should return empty blob if no mediaRecorder", async () => {
    const { Recorder } = await import("../audio/Recorder");
    const recorder = new Recorder();

    const blob = await recorder.stop();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(0);
  });
});

describe("Clip interface", () => {
  it("should accept valid Clip objects", async () => {
    const clip = {
      id: "clip-1",
      track: "Lead Vocal",
      start: 0,
      duration: 10,
      blob: new Blob(["audio"], { type: "audio/wav" }),
    };

    expect(clip.id).toBe("clip-1");
    expect(clip.track).toBe("Lead Vocal");
    expect(clip.start).toBe(0);
    expect(clip.duration).toBe(10);
    expect(clip.blob).toBeInstanceOf(Blob);
  });
});

describe("ExportEngine", () => {
  it("should export a mix using Tone.Offline", async () => {
    const { exportMix } = await import("../audio/ExportEngine");
    const Tone = await import("tone");

    const setupGraph = vi.fn();
    await exportMix(10, setupGraph);

    expect(Tone.Offline).toHaveBeenCalled();
  });

  it("should convert buffer to WAV blob", async () => {
    const { bufferToWav } = await import("../audio/ExportEngine");

    // Create a mock AudioBuffer
    const mockAudioBuffer = {
      numberOfChannels: 1,
      sampleRate: 44100,
      length: 100,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(100)),
    };

    const mockToneBuffer = {
      get: vi.fn().mockReturnValue(mockAudioBuffer),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = bufferToWav(mockToneBuffer as any);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBeGreaterThan(44); // At least WAV header
  });

  it("should return empty blob for null buffer", async () => {
    const { bufferToWav } = await import("../audio/ExportEngine");

    const mockToneBuffer = {
      get: vi.fn().mockReturnValue(null),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = bufferToWav(mockToneBuffer as any);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(0);
  });

  it("should download a blob as a file", async () => {
    const { downloadBlob } = await import("../audio/ExportEngine");

    const mockAnchor = {
      href: "",
      download: "",
      click: vi.fn(),
    };
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(mockAnchor as unknown as HTMLElement);

    // jsdom doesn't provide URL.createObjectURL/revokeObjectURL, so stub them
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue("blob:test-url");
    URL.revokeObjectURL = vi.fn();

    const blob = new Blob(["test"], { type: "audio/wav" });
    downloadBlob(blob, "test.wav");

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(mockAnchor.download).toBe("test.wav");
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");

    createElementSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });
});
