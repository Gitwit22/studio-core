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

registerCommand("view:toggleTimeline", () => {
  console.log("Toggle timeline")
})

registerCommand("view:toggleFXRack", () => {
  console.log("Toggle FX rack")
})

registerCommand("view:toggleMasterMeter", () => {
  console.log("Toggle master meter")
})

registerCommand("view:snapToGrid", () => {
  console.log("Snap to Grid enabled")
})

registerCommand("view:freeMove", () => {
  console.log("Free Move enabled")
})

registerCommand("view:zoomIn", () => {
  const state = useStudioStore.getState()
  state.setZoom(Math.min(state.zoom * 1.25, 10))
})

registerCommand("view:zoomOut", () => {
  const state = useStudioStore.getState()
  state.setZoom(Math.max(state.zoom / 1.25, 0.1))
})

registerCommand("view:resetLayout", () => {
  console.log("Reset layout")
})

// Modal commands
registerCommand("modal:settings", () => {
  useStudioStore.getState().setActiveModal("settings")
})

registerCommand("help:quickStart", () => {
  useStudioStore.getState().setActiveModal("quickStart")
})

registerCommand("help:keyboardShortcuts", () => {
  useStudioStore.getState().setActiveModal("keyboardShortcuts")
})

registerCommand("help:troubleshooting", () => {
  useStudioStore.getState().setActiveModal("troubleshooting")
})

registerCommand("help:recordingTips", () => {
  console.log("Recording tips")
})

registerCommand("help:reportProblem", () => {
  useStudioStore.getState().setActiveModal("reportProblem")
})

registerCommand("help:about", () => {
  useStudioStore.getState().setActiveModal("about")
})
