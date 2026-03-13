import { registerCommand } from "../commandBus";

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
