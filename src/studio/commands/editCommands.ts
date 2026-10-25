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
  const s = useStudioStore.getState()
  if (s.selectedClipId) s.duplicateClip(s.selectedClipId)
})

registerCommand("edit:delete", () => {
  const s = useStudioStore.getState()
  const clip = s.clips.find((c) => c.id === s.selectedClipId)
  if (!clip || clip.locked) return
  s.pushUndo()
  s.removeClip(clip.id)
})

registerCommand("edit:tool-select", () => {
  useStudioStore.getState().setEditTool("select")
})

registerCommand("edit:tool-blade", () => {
  useStudioStore.getState().setEditTool("blade")
})

registerCommand("edit:tool-slip", () => {
  useStudioStore.getState().setEditTool("slip")
})

registerCommand("edit:split-at-playhead", () => {
  const s = useStudioStore.getState()
  if (s.selectedClipId) s.splitClip(s.selectedClipId, s.playhead)
})
