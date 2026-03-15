export interface MenuItem {
  label: string;
  action: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const studioMenu: MenuGroup[] = [
  {
    title: "File",
    items: [
      { label: "New Session", action: "session:new", shortcut: "Ctrl+N" },
      { label: "Open Session", action: "session:open", shortcut: "Ctrl+O" },
      { label: "Save Session", action: "project:save", shortcut: "Ctrl+S" },
      { label: "Save Session As", action: "session:saveAs", shortcut: "Ctrl+Shift+S" },
      { label: "", action: "", separator: true },
      { label: "Import Audio", action: "file:importAudio" },
      { label: "Export Mix", action: "file:exportMix" },
      { label: "", action: "", separator: true },
      { label: "Recent Sessions", action: "session:recent", disabled: true },
      { label: "Session Info", action: "session:info" },
      { label: "", action: "", separator: true },
      { label: "Close Session", action: "session:close" },
    ],
  },
  {
    title: "Edit",
    items: [
      { label: "Undo", action: "edit:undo", shortcut: "Ctrl+Z" },
      { label: "Redo", action: "edit:redo", shortcut: "Ctrl+Shift+Z" },
      { label: "", action: "", separator: true },
      { label: "Cut", action: "edit:cut", shortcut: "Ctrl+X" },
      { label: "Copy", action: "edit:copy", shortcut: "Ctrl+C" },
      { label: "Paste", action: "edit:paste", shortcut: "Ctrl+V" },
      { label: "", action: "", separator: true },
      { label: "Duplicate Clip", action: "edit:duplicateClip", shortcut: "Ctrl+D" },
      { label: "Delete", action: "edit:delete", shortcut: "Del" },
      { label: "Select All", action: "edit:selectAll", shortcut: "Ctrl+A" },
    ],
  },
  {
    title: "Track",
    items: [
      { label: "Add Audio Track", action: "track:addAudio" },
      { label: "Add Vocal Track", action: "track:addVocal" },
      { label: "", action: "", separator: true },
      { label: "Duplicate Track", action: "track:duplicate", disabled: true },
      { label: "Rename Track", action: "track:rename", disabled: true },
      { label: "Delete Track", action: "track:delete", disabled: true },
      { label: "", action: "", separator: true },
      { label: "Arm Track", action: "track:arm", disabled: true },
      { label: "Mute Track", action: "track:mute", disabled: true },
      { label: "Solo Track", action: "track:solo", disabled: true },
      { label: "", action: "", separator: true },
      { label: "Import to Selected Track", action: "track:import", disabled: true },
      { label: "Move Track Up", action: "track:moveUp", disabled: true },
      { label: "Move Track Down", action: "track:moveDown", disabled: true },
      { label: "Change Track Color", action: "track:changeColor", disabled: true },
    ],
  },
  {
    title: "View",
    items: [
      { label: "Show Mixer", action: "view:toggleMixer" },
      { label: "Show Timeline", action: "view:toggleTimeline", disabled: true },
      { label: "Show FX Rack", action: "view:toggleFXRack", disabled: true },
      { label: "Show Master Meter", action: "view:toggleMasterMeter", disabled: true },
      { label: "", action: "", separator: true },
      { label: "Snap to Grid", action: "view:snapToGrid" },
      { label: "Free Move", action: "view:freeMove" },
      { label: "", action: "", separator: true },
      { label: "Zoom In", action: "view:zoomIn", shortcut: "Ctrl+=" },
      { label: "Zoom Out", action: "view:zoomOut", shortcut: "Ctrl+-" },
      { label: "Reset Layout", action: "view:resetLayout" },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Open Settings", action: "modal:settings" },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "Quick Start", action: "help:quickStart" },
      { label: "Keyboard Shortcuts", action: "help:keyboardShortcuts" },
      { label: "", action: "", separator: true },
      { label: "Troubleshooting", action: "help:troubleshooting" },
      { label: "Recording Tips", action: "help:recordingTips", disabled: true },
      { label: "", action: "", separator: true },
      { label: "Report Problem", action: "help:reportProblem" },
      { label: "About StreamLine Music Studio", action: "help:about" },
    ],
  },
];
