import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement media playback APIs; stub them to avoid unhandled rejections.
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: () => Promise.resolve(),
});

Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value: () => undefined,
});

Object.defineProperty(HTMLMediaElement.prototype, "load", {
  configurable: true,
  value: () => undefined,
});
