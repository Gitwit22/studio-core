import { registerCommand } from "../commandBus";
import { useStudioStore } from "../engine/studioStore";

registerCommand("track:import", () => {
  // Trigger the hidden file input in ChannelStrips by dispatching a custom event
  window.dispatchEvent(new CustomEvent("studio:import-audio"));
});

registerCommand("track:addAudio", () => {
  useStudioStore.getState().pushUndo();
  useStudioStore.getState().addTrack("audio");
});

registerCommand("track:addVocal", () => {
  useStudioStore.getState().pushUndo();
  useStudioStore.getState().addTrack("vocal");
});

registerCommand("track:addInstrument", () => {
  useStudioStore.getState().pushUndo();
  useStudioStore.getState().addTrack("instrument");
});

registerCommand("track:addBeat", () => {
  useStudioStore.getState().pushUndo();
  useStudioStore.getState().addTrack("beat");
});

registerCommand("track:addBus", () => {
  useStudioStore.getState().pushUndo();
  useStudioStore.getState().addTrack("bus");
});

registerCommand("instrument:sampler", () => {
  console.log("Opening sampler");
});
