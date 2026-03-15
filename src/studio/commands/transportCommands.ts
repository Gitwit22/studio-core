import { registerCommand } from "../commandBus"
import {
  playTransport,
  pauseTransport,
  stopTransport,
  rewindTransport,
  recordTransport,
  stopRecording,
} from "../engine/transportEngine"
import { useStudioStore } from "../engine/studioStore"

registerCommand("transport:play", () => {
  const state = useStudioStore.getState()
  if (state.isPlaying) {
    pauseTransport()
  } else {
    playTransport()
  }
})

registerCommand("transport:pause", () => {
  pauseTransport()
})

registerCommand("transport:stop", () => {
  stopTransport()
  stopRecording()
})

registerCommand("transport:rewind", () => {
  rewindTransport()
})

registerCommand("transport:record", () => {
  recordTransport()
})

registerCommand("view:toggleMixer", () => {
  useStudioStore.getState().togglePanel("mixer")
})
