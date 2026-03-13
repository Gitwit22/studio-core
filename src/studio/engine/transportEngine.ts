import { useStudioStore } from "./studioStore"

let animationFrame: number | null = null
let lastTime = 0

export function playTransport() {
  const store = useStudioStore.getState()
  if (store.isPlaying) return

  useStudioStore.getState().setPlaying(true)
  lastTime = performance.now()

  const tick = (now: number) => {
    const state = useStudioStore.getState()
    if (!state.isPlaying) return

    const deltaSeconds = (now - lastTime) / 1000
    lastTime = now

    const beatsPerSecond = state.bpm / 60
    const nextPlayhead = state.playhead + deltaSeconds * beatsPerSecond

    if (state.loop.enabled && nextPlayhead >= state.loop.end) {
      state.setPlayhead(state.loop.start)
    } else {
      state.setPlayhead(nextPlayhead)
    }

    animationFrame = requestAnimationFrame(tick)
  }

  animationFrame = requestAnimationFrame(tick)
}

export function stopTransport() {
  useStudioStore.getState().setPlaying(false)
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = null
}

export function recordTransport() {
  const state = useStudioStore.getState()
  if (!state.isPlaying) {
    playTransport()
  }
  state.setRecording(true)
}

export function stopRecording() {
  useStudioStore.getState().setRecording(false)
}
