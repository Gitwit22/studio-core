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

// Mute/solo must go through updateMixerChannel so MixerEngine sees the change
registerCommand("track:mute", () => {
  const state = useStudioStore.getState();
  if (state.selectedTrackId) {
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    if (track) {
      const ch = state.mixerChannels.find(c => c.id === track.channelId);
      if (ch) state.updateMixerChannel(ch.id, { mute: !ch.mute });
    }
  }
});

registerCommand("track:solo", () => {
  const state = useStudioStore.getState();
  if (state.selectedTrackId) {
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    if (track) {
      const ch = state.mixerChannels.find(c => c.id === track.channelId);
      if (ch) state.updateMixerChannel(ch.id, { solo: !ch.solo });
    }
  }
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
