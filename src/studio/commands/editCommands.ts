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
