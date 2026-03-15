export const studioMenu = [
  {
    title: "File",
    items: [
      { label: "New Session", action: "project:new" },
      { label: "Open Session", action: "project:open" },
      { label: "Save", action: "project:save" },
      { label: "Save As", action: "project:saveAs" },
      { label: "Import Audio", action: "track:import" },
      { label: "Export", action: "project:export" },
    ],
  },
  {
    title: "Edit",
    items: [
      { label: "Undo", action: "edit:undo" },
      { label: "Redo", action: "edit:redo" },
      { label: "Cut", action: "edit:cut" },
      { label: "Copy", action: "edit:copy" },
      { label: "Paste", action: "edit:paste" },
    ],
  },
  {
    title: "Insert",
    items: [
      { label: "Audio Track", action: "track:addAudio" },
      { label: "Vocal Track", action: "track:addVocal" },
      { label: "Instrument Track", action: "track:addInstrument" },
      { label: "Beat Track", action: "track:addBeat" },
      { label: "Bus Track", action: "track:addBus" },
      { label: "MIDI Track", action: "track:addMidi" },
      { label: "Sampler", action: "instrument:sampler" },
    ],
  },
  {
    title: "Transport",
    items: [
      { label: "Play", action: "transport:play" },
      { label: "Stop", action: "transport:stop" },
      { label: "Record", action: "transport:record" },
    ],
  },
];
