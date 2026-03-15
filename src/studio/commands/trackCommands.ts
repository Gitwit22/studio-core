import { registerCommand } from "../commandBus";
import { useStudioStore } from "../engine/studioStore";

registerCommand("instrument:sampler", () => {
  console.log("Opening sampler");
});

registerCommand("track:addVocal", () => {
  const state = useStudioStore.getState();
  const vocalCount = state.tracks.filter(t => t.name.startsWith("Vocal")).length + 1;
  state.addTrack("audio", `Vocal ${vocalCount}`);
});

registerCommand("track:duplicate", () => {
  console.log("Duplicate track");
});

registerCommand("track:rename", () => {
  console.log("Rename track");
});

registerCommand("track:delete", () => {
  const state = useStudioStore.getState();
  if (state.selectedTrackId) {
    state.removeTrack(state.selectedTrackId);
  }
});

registerCommand("track:arm", () => {
  const state = useStudioStore.getState();
  if (state.selectedTrackId) {
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    if (track) state.updateTrack(track.id, { armed: !track.armed });
  }
});

registerCommand("track:mute", () => {
  const state = useStudioStore.getState();
  if (state.selectedTrackId) {
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    if (track) state.updateTrack(track.id, { mute: !track.mute });
  }
});

registerCommand("track:solo", () => {
  const state = useStudioStore.getState();
  if (state.selectedTrackId) {
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    if (track) state.updateTrack(track.id, { solo: !track.solo });
  }
});

registerCommand("track:import", () => {
  console.log("Import to selected track");
});

registerCommand("track:moveUp", () => {
  console.log("Move track up");
});

registerCommand("track:moveDown", () => {
  console.log("Move track down");
});

registerCommand("track:changeColor", () => {
  console.log("Change track color");
});
