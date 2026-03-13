import { registerCommand } from "../commandBus";

registerCommand("track:addAudio", () => {
  console.log("Adding audio track");
});

registerCommand("track:addMidi", () => {
  console.log("Adding MIDI track");
});

registerCommand("instrument:sampler", () => {
  console.log("Opening sampler");
});
