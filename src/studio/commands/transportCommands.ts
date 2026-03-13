import { registerCommand } from "../commandBus";

registerCommand("transport:play", () => {
  console.log("Play");
});

registerCommand("transport:stop", () => {
  console.log("Stop");
});

registerCommand("transport:record", () => {
  console.log("Record");
});
