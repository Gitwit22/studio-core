import { registerCommand } from "../commandBus";

registerCommand("edit:undo", () => {
  console.log("Undo");
});

registerCommand("edit:redo", () => {
  console.log("Redo");
});

registerCommand("edit:cut", () => {
  console.log("Cut");
});

registerCommand("edit:copy", () => {
  console.log("Copy");
});

registerCommand("edit:paste", () => {
  console.log("Paste");
});

registerCommand("edit:duplicateClip", () => {
  console.log("Duplicate clip");
});

registerCommand("edit:delete", () => {
  console.log("Delete");
});

registerCommand("edit:selectAll", () => {
  console.log("Select all");
});
