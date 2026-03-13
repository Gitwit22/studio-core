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
const commands: Record<string, () => void> = {};

export function registerCommand(name: string, handler: () => void) {
  commands[name] = handler;
}

export function runCommand(name: string) {
  if (commands[name]) {
    commands[name]();
  } else {
    console.warn("Command not implemented:", name);
  }
}

/** Clear all registered commands. Intended for use in tests. */
export function resetCommands() {
  for (const key of Object.keys(commands)) {
    delete commands[key];
  }
}
