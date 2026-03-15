import { registerCommand } from "../commandBus"
import { useStudioStore } from "../engine/studioStore"

registerCommand("edit:undo", () => {
  useStudioStore.getState().undo()
})

registerCommand("edit:redo", () => {
  useStudioStore.getState().redo()
})

registerCommand("edit:cut", () => {
  useStudioStore.getState().cutClip()
})

registerCommand("edit:copy", () => {
  useStudioStore.getState().copyClip()
})

registerCommand("edit:paste", () => {
  useStudioStore.getState().pasteClip()
})

registerCommand("edit:toggle-grid-snap", () => {
  useStudioStore.getState().toggleSnapToGrid()
})

registerCommand("edit:duplicateClip", () => {
  console.log("Duplicate clip");
});

registerCommand("edit:delete", () => {
  console.log("Delete");
});

registerCommand("edit:selectAll", () => {
  console.log("Select all");
});
