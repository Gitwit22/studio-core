import { runCommand } from "./commandBus"

export function registerStudioShortcuts() {
  const handler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    if (e.key === " ") {
      e.preventDefault()
      runCommand("transport:play")
    }

    if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) {
      runCommand("transport:record")
    }

    if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      runCommand("edit:toggle-grid-snap")
    }

    // Home key = rewind
    if (e.key === "Home") {
      e.preventDefault()
      runCommand("transport:rewind")
    }

    // Ctrl+Z = undo, Ctrl+Shift+Z = redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault()
      if (e.shiftKey) {
        runCommand("edit:redo")
      } else {
        runCommand("edit:undo")
      }
    }

    // Ctrl+X / Ctrl+C / Ctrl+V
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
      e.preventDefault()
      runCommand("edit:cut")
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault()
      runCommand("edit:copy")
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
      e.preventDefault()
      runCommand("edit:paste")
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault()
      runCommand("project:save")
    }

    // Ctrl+N = new session
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault()
      runCommand("project:new")
    }

    // Ctrl+E = export
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
      e.preventDefault()
      runCommand("project:export")
    }
  }

  window.addEventListener("keydown", handler)

  return () => {
    window.removeEventListener("keydown", handler)
  }
}
