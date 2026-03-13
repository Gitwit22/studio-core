import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCommand, runCommand, resetCommands } from "@/studio/commandBus";

describe("commandBus", () => {
  beforeEach(() => {
    resetCommands();
  });

  it("should register and run a command", () => {
    const handler = vi.fn();
    registerCommand("test:run", handler);
    runCommand("test:run");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("should warn when running an unregistered command", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    runCommand("nonexistent:command");
    expect(warnSpy).toHaveBeenCalledWith(
      "Command not implemented:",
      "nonexistent:command"
    );
    warnSpy.mockRestore();
  });

  it("should overwrite a previously registered command", () => {
    const first = vi.fn();
    const second = vi.fn();
    registerCommand("test:overwrite", first);
    registerCommand("test:overwrite", second);
    runCommand("test:overwrite");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
