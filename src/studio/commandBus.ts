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
