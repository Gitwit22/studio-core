import { registerCommand } from "../commandBus";

registerCommand("instrument:sampler", () => {
  console.log("Opening sampler");
});
