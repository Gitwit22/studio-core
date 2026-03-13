import { runCommand } from "./commandBus"

export function registerStudioShortcuts() {
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    if (e.code === "Space") {
      e.preventDefault()
      runCommand("transport:play")
    }

    if (e.key.toLowerCase() === "r") {
      runCommand("transport:record")
    }

    if (e.ctrlKey && e.key.toLowerCase() === "s") {
      e.preventDefault()
      runCommand("project:save")
    }
  })
}
