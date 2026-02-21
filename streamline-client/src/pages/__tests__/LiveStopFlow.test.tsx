import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Live from "../Live";

type FetchResponse = {
  ok: boolean;
  status?: number;
  json?: () => Promise<any>;
  text?: () => Promise<string>;
};

let destroyedCount = 0;

vi.mock("hls.js", () => {
  class HlsMock {
    static Events = {
      MANIFEST_PARSED: "MANIFEST_PARSED",
      ERROR: "ERROR",
      FRAG_BUFFERED: "FRAG_BUFFERED",
      LEVEL_SWITCHED: "LEVEL_SWITCHED",
    };

    static isSupported() {
      return true;
    }
    loadSource() {}
    attachMedia() {}
    on() {}
    startLoad() {}
    destroy() {
      destroyedCount += 1;
    }
  }

  return { default: HlsMock };
});

function flushMicrotasks() {
  return new Promise<void>((resolve) => {
    queueMicrotask(() => resolve());
  });
}

async function spinUntil(fn: () => void, opts?: { stepMs?: number; maxSteps?: number }) {
  const stepMs = opts?.stepMs ?? 50;
  const maxSteps = opts?.maxSteps ?? 120;
  let lastErr: unknown = null;
  for (let i = 0; i < maxSteps; i++) {
    try {
      fn();
      return;
    } catch (e) {
      lastErr = e;
    }
    await vi.advanceTimersByTimeAsync(stepMs);
    await flushMicrotasks();
  }
  throw lastErr;
}

describe("Live viewer stop cascade", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    destroyedCount = 0;
  });

  it(
    "host starts, viewer watches, host stops -> viewer ends + player destroyed",
    async () => {
      vi.useFakeTimers();

      const savedEmbedId = "embed_abc";
      const roomId = "room_123";
      const playlistUrl = "https://example.com/hls/room_123/live.m3u8";

      // In-memory fake server state.
      let isLive = false;

      const fetchMock = vi.fn(async (input: any, init?: any): Promise<FetchResponse> => {
        const url = String(typeof input === "string" ? input : input?.url || "");
        const method = String(init?.method || "GET").toUpperCase();

        // Resolve savedEmbedId -> activeRoomId
        if (url.includes(`/api/saved-embeds/public/${encodeURIComponent(savedEmbedId)}`) && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              savedEmbedId,
              name: "Test Embed",
              activeRoomId: roomId,
              viewerPath: `/live/${savedEmbedId}`,
            }),
            text: async () => "",
          };
        }

        // Public viewer config
        if (url.includes(`/api/public/rooms/${encodeURIComponent(roomId)}/hls-config`) && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              roomId,
              hlsConfig: {
                enabled: true,
                theme: "dark",
                offlineMessage: "This stream is offline.",
              },
            }),
            text: async () => "",
          };
        }

        // Viewer poll endpoint
        if (url.includes(`/api/public/hls/${encodeURIComponent(roomId)}`) && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: isLive ? "live" : "idle",
              playlistUrl: isLive ? playlistUrl : null,
              viewerCount: 1,
            }),
            text: async () => "",
          };
        }

        // Manifest readiness probe (useHlsReadiness)
        if (url.startsWith(playlistUrl) && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () => "#EXTM3U\n",
          };
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({ error: "not_found" }),
          text: async () => "not_found",
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = fetchMock;

      const { container } = render(
        <MemoryRouter initialEntries={[`/live/${savedEmbedId}`]}>
          <Routes>
            <Route path="/live/:savedEmbedId" element={<Live />} />
          </Routes>
        </MemoryRouter>
      );

      await flushMicrotasks();

      // Initial state: offline (not live yet)
      await spinUntil(() => {
        expect(screen.getByText("Starting soon")).toBeInTheDocument();
      });

      // Host starts the stream
      isLive = true;
      await flushMicrotasks();

      // Let viewer poll + readiness probe complete.
      await vi.advanceTimersByTimeAsync(3500);
      await flushMicrotasks();

      await spinUntil(() => {
        expect(screen.getByText("Watching live")).toBeInTheDocument();
      });

      await spinUntil(() => {
        const video = container.querySelector("video");
        expect(video).toBeTruthy();
      });

      // Host stops
      isLive = false;
      await flushMicrotasks();

      // Next poll should observe offline + ended.
      await vi.advanceTimersByTimeAsync(3500);
      await flushMicrotasks();

      await spinUntil(() => {
        expect(screen.getByText("Stream ended.")).toBeInTheDocument();
      });

      // Player teardown: hls.js destroyed, and <video> src cleared.
      await spinUntil(() => {
        expect(destroyedCount).toBeGreaterThanOrEqual(1);
      });

      await spinUntil(() => {
        const video = container.querySelector("video") as HTMLVideoElement | null;
        expect(video).toBeNull();
      });

      // Sanity: we exercised viewer poll endpoint.
      expect(fetchMock).toHaveBeenCalled();
    },
    30000
  );
});
