import { registerCommand } from "../commandBus";
import { useStudioStore } from "../engine/studioStore";

registerCommand("project:new", () => {
  console.log("Creating new project");
});

registerCommand("project:open", () => {
  console.log("Opening project");
});

registerCommand("project:save", () => {
  console.log("Saving project");
});

registerCommand("project:saveAs", () => {
  console.log("Saving project as...");
});

registerCommand("project:export", () => {
  console.log("Exporting project");
});

// Session commands (open modals)
registerCommand("session:new", () => {
  useStudioStore.getState().setActiveModal("newSession");
});

registerCommand("session:open", () => {
  useStudioStore.getState().setActiveModal("openSession");
});

registerCommand("session:saveAs", () => {
  useStudioStore.getState().setActiveModal("saveSessionAs");
});

registerCommand("session:info", () => {
  useStudioStore.getState().setActiveModal("sessionInfo");
});

registerCommand("session:close", () => {
  useStudioStore.getState().reset();
});

registerCommand("session:recent", () => {
  console.log("Recent sessions");
});

// File commands
registerCommand("file:importAudio", () => {
  console.log("Importing audio");
});

registerCommand("file:exportMix", () => {
  useStudioStore.getState().setActiveModal("exportMix");
});
