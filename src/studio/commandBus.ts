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

export function hasCommand(name: string): boolean {
  return name in commands;
}

/** Clear all registered commands. Intended for use in tests. */
export function resetCommands() {
  for (const key of Object.keys(commands)) {
    delete commands[key];
  }
}
