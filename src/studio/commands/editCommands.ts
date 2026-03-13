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
