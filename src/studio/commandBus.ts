type CommandHandler = () => void

const commands = new Map<string, CommandHandler>()

export function registerCommand(name: string, handler: CommandHandler) {
  commands.set(name, handler)
}

export function runCommand(name: string) {
  const handler = commands.get(name)
  if (handler) {
    handler()
  }
}

export function hasCommand(name: string): boolean {
  return commands.has(name)
}
