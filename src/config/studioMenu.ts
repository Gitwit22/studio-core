export const studioMenu = [
  {
    title: "File",
    items: [
      { label: "New Project", action: "project:new" },
      { label: "Open Project", action: "project:open" },
      { label: "Save", action: "project:save" },
      { label: "Save As", action: "project:saveAs" },
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
