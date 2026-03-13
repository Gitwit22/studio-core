import { runCommand } from "./commandBus"

export function registerStudioShortcuts() {
  const handler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    if (e.key === " ") {
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
  }

  window.addEventListener("keydown", handler)

  return () => {
    window.removeEventListener("keydown", handler)
  }
}
