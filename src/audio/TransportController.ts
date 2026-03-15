// Transport controller logic has been merged into src/studio/engine/transportEngine.ts
// This file is kept for backward compatibility — re-export from the single source of truth.

export {
  playTransport as play,
  stopTransport as stop,
  recordTransport as startRecordTransport,
  setBPM,
  getPosition,
} from "@/studio/engine/transportEngine"
