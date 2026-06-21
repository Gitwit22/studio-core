import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const port = process.env.PORT?.trim() || "4173"
const host = process.env.HOST?.trim() || "0.0.0.0"
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const viteCliPath = path.resolve(scriptDir, "../node_modules/vite/bin/vite.js")

const child = spawn(
  process.execPath,
  [viteCliPath, "preview", "--host", host, "--port", port],
  {
    stdio: "inherit",
    shell: false,
  },
)

child.on("exit", (code) => {
  process.exit(code ?? 0)
})