import { registerCommand } from "../commandBus"
import {
  playTransport,
  stopTransport,
  recordTransport,
  stopRecording,
} from "../engine/transportEngine"
import { useStudioStore } from "../engine/studioStore"

registerCommand("transport:play", () => {
  playTransport()
})

registerCommand("transport:stop", () => {
  stopTransport()
  stopRecording()
})

registerCommand("transport:record", () => {
  recordTransport()
})

registerCommand("track:addAudio", () => {
  useStudioStore.getState().addTrack("audio")
})

registerCommand("track:addMidi", () => {
  useStudioStore.getState().addTrack("midi")
})

registerCommand("view:toggleMixer", () => {
  useStudioStore.getState().togglePanel("mixer")
})
