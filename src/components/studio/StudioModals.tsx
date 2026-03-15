import {
  FilePlus,
  FolderOpen,
  SaveAll,
  FileText,
  Keyboard,
  Rocket,
  Wrench,
  AlertTriangle,
  Trash2,
  AlertCircle,
} from "lucide-react";
import StudioModal from "./StudioModal";

/* ------------------------------------------------------------------ */
/*  Shared placeholder content                                        */
/* ------------------------------------------------------------------ */

const PlaceholderContent = ({ description }: { description: string }) => (
  <div className="text-center py-6">
    <p className="text-xs text-studio-text-dim leading-relaxed">{description}</p>
  </div>
);

const ModalActions = ({
  primaryLabel,
  onPrimary,
  onCancel,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  onCancel: () => void;
}) => (
  <div className="flex gap-3 pt-4">
    <button
      onClick={onPrimary}
      className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-studio-teal/40 bg-studio-teal/15 text-studio-teal hover:bg-studio-teal/25"
    >
      {primaryLabel}
    </button>
    <button
      onClick={onCancel}
      className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-border bg-studio-metal text-studio-text-dim hover:text-foreground hover:border-studio-metal-light"
    >
      Cancel
    </button>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Modal Props                                                       */
/* ------------------------------------------------------------------ */

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  New Session Modal                                                 */
/* ------------------------------------------------------------------ */

export const NewSessionModal = ({ open, onClose }: ModalProps) => (
  <StudioModal open={open} onClose={onClose} title="New Session" icon={<FilePlus className="w-4 h-4 text-studio-teal" />}>
    <div className="space-y-4">
      <div>
        <label className="text-[10px] uppercase tracking-widest text-studio-text-dim font-semibold mb-2 block">
          Session Name
        </label>
        <input
          type="text"
          placeholder="Untitled Session"
          className="w-full bg-studio-metal border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-studio-teal/50 transition-colors"
        />
      </div>
      <ModalActions primaryLabel="Create" onPrimary={onClose} onCancel={onClose} />
    </div>
  </StudioModal>
);

/* ------------------------------------------------------------------ */
/*  Open Session Modal                                                */
/* ------------------------------------------------------------------ */

export const OpenSessionModal = ({ open, onClose }: ModalProps) => (
  <StudioModal open={open} onClose={onClose} title="Open Session" icon={<FolderOpen className="w-4 h-4 text-studio-teal" />}>
    <PlaceholderContent description="Browse and open a previously saved session. File picker integration will be connected to the storage layer." />
    <ModalActions primaryLabel="Browse" onPrimary={onClose} onCancel={onClose} />
  </StudioModal>
);

/* ------------------------------------------------------------------ */
/*  Save Session As Modal                                             */
/* ------------------------------------------------------------------ */

export const SaveSessionAsModal = ({ open, onClose }: ModalProps) => (
  <StudioModal open={open} onClose={onClose} title="Save Session As" icon={<SaveAll className="w-4 h-4 text-studio-teal" />}>
    <div className="space-y-4">
      <div>
        <label className="text-[10px] uppercase tracking-widest text-studio-text-dim font-semibold mb-2 block">
          File Name
        </label>
        <input
          type="text"
          placeholder="My Session"
          className="w-full bg-studio-metal border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-studio-teal/50 transition-colors"
        />
      </div>
      <ModalActions primaryLabel="Save" onPrimary={onClose} onCancel={onClose} />
    </div>
  </StudioModal>
);

/* ------------------------------------------------------------------ */
/*  Session Info Modal                                                */
/* ------------------------------------------------------------------ */

export const SessionInfoModal = ({ open, onClose }: ModalProps) => (
  <StudioModal open={open} onClose={onClose} title="Session Info" icon={<FileText className="w-4 h-4 text-studio-teal" />}>
    <div className="space-y-3">
      <div className="flex justify-between text-xs py-1.5 px-3 rounded bg-studio-metal/50">
        <span className="text-studio-text-dim">Session Name</span>
        <span className="text-foreground font-mono">Vocal_Session_01</span>
      </div>
      <div className="flex justify-between text-xs py-1.5 px-3 rounded bg-studio-metal/50">
        <span className="text-studio-text-dim">Tracks</span>
        <span className="text-foreground font-mono">0</span>
      </div>
      <div className="flex justify-between text-xs py-1.5 px-3 rounded bg-studio-metal/50">
        <span className="text-studio-text-dim">Sample Rate</span>
        <span className="text-foreground font-mono">48000 Hz</span>
      </div>
      <div className="flex justify-between text-xs py-1.5 px-3 rounded bg-studio-metal/50">
        <span className="text-studio-text-dim">BPM</span>
        <span className="text-foreground font-mono">120</span>
      </div>
    </div>
  </StudioModal>
);

/* ------------------------------------------------------------------ */
/*  Keyboard Shortcuts Modal                                          */
/* ------------------------------------------------------------------ */

const shortcutList = [
  { key: "Space", desc: "Play / Pause" },
  { key: "R", desc: "Record" },
  { key: "Ctrl+S", desc: "Save Session" },
  { key: "Ctrl+Z", desc: "Undo" },
  { key: "Ctrl+Shift+Z", desc: "Redo" },
  { key: "Ctrl+N", desc: "New Session" },
  { key: "Ctrl+X", desc: "Cut" },
  { key: "Ctrl+C", desc: "Copy" },
  { key: "Ctrl+V", desc: "Paste" },
  { key: "Del", desc: "Delete" },
  { key: "Ctrl+=", desc: "Zoom In" },
  { key: "Ctrl+-", desc: "Zoom Out" },
];

export const KeyboardShortcutsModal = ({ open, onClose }: ModalProps) => (
  <StudioModal
    open={open}
    onClose={onClose}
    title="Keyboard Shortcuts"
    icon={<Keyboard className="w-4 h-4 text-studio-teal" />}
    width="380px"
  >
    <div className="space-y-1">
      {shortcutList.map((s) => (
        <div key={s.key} className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-studio-metal/50 transition-colors">
          <span className="text-xs text-studio-text-dim">{s.desc}</span>
          <kbd className="text-[10px] font-mono bg-studio-metal border border-border rounded px-2 py-0.5 text-foreground">
            {s.key}
          </kbd>
        </div>
      ))}
    </div>
  </StudioModal>
);

/* ------------------------------------------------------------------ */
/*  Quick Start Modal                                                 */
/* ------------------------------------------------------------------ */

export const QuickStartModal = ({ open, onClose }: ModalProps) => (
  <StudioModal open={open} onClose={onClose} title="Quick Start" icon={<Rocket className="w-4 h-4 text-studio-teal" />} width="460px">
    <div className="space-y-4">
      <div className="space-y-3">
        {[
          { step: "1", title: "Add a Track", desc: "Use Track → Add Audio Track to create your first track." },
          { step: "2", title: "Arm for Recording", desc: "Click the record arm button on the track header." },
          { step: "3", title: "Record", desc: "Press R or click the record button in the transport controls." },
          { step: "4", title: "Mix", desc: "Adjust volume and pan in the mixer on the left." },
          { step: "5", title: "Export", desc: "Go to File → Export Mix to render your final audio." },
        ].map((item) => (
          <div key={item.step} className="flex gap-3 px-3 py-2 rounded bg-studio-metal/30">
            <div className="w-5 h-5 rounded-full bg-studio-teal/20 text-studio-teal text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {item.step}
            </div>
            <div>
              <p className="text-xs text-foreground font-medium">{item.title}</p>
              <p className="text-[11px] text-studio-text-dim leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </StudioModal>
);

/* ------------------------------------------------------------------ */
/*  Troubleshooting Modal                                             */
/* ------------------------------------------------------------------ */

export const TroubleshootingModal = ({ open, onClose }: ModalProps) => (
  <StudioModal open={open} onClose={onClose} title="Troubleshooting" icon={<Wrench className="w-4 h-4 text-studio-teal" />} width="460px">
    <div className="space-y-3">
      {[
        { q: "No audio input detected", a: "Check that your microphone is connected and browser permissions are granted. Try Settings → Audio → Reconnect Devices." },
        { q: "Playback is stuttering", a: "Close other browser tabs and applications. Try increasing the buffer size in audio settings." },
        { q: "Recording not starting", a: "Make sure a track is armed for recording. Check the track header for the arm button." },
        { q: "Export not working", a: "Ensure you have at least one clip on the timeline before exporting." },
      ].map((item) => (
        <div key={item.q} className="px-3 py-2.5 rounded bg-studio-metal/30 space-y-1">
          <p className="text-xs text-foreground font-medium">{item.q}</p>
          <p className="text-[11px] text-studio-text-dim leading-relaxed">{item.a}</p>
        </div>
      ))}
    </div>
  </StudioModal>
);

/* ------------------------------------------------------------------ */
/*  Report Problem Modal                                              */
/* ------------------------------------------------------------------ */

export const ReportProblemModal = ({ open, onClose }: ModalProps) => (
  <StudioModal open={open} onClose={onClose} title="Report Problem" icon={<AlertCircle className="w-4 h-4 text-studio-teal" />}>
    <div className="space-y-4">
      <div>
        <label className="text-[10px] uppercase tracking-widest text-studio-text-dim font-semibold mb-2 block">
          Describe the Issue
        </label>
        <textarea
          rows={4}
          placeholder="What happened?"
          className="w-full bg-studio-metal border border-border rounded px-3 py-2 text-xs text-foreground outline-none resize-none focus:border-studio-teal/50 transition-colors"
        />
      </div>
      <ModalActions primaryLabel="Submit" onPrimary={onClose} onCancel={onClose} />
    </div>
  </StudioModal>
);

/* ------------------------------------------------------------------ */
/*  Confirm Delete Modal                                              */
/* ------------------------------------------------------------------ */

export const ConfirmDeleteModal = ({ open, onClose }: ModalProps) => (
  <StudioModal open={open} onClose={onClose} title="Confirm Delete" icon={<Trash2 className="w-4 h-4 text-red-400" />} width="360px">
    <div className="space-y-4">
      <p className="text-xs text-studio-text-dim text-center leading-relaxed">
        Are you sure you want to delete this item? This action cannot be undone.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-red-400/40 bg-red-400/15 text-red-400 hover:bg-red-400/25"
        >
          Delete
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-border bg-studio-metal text-studio-text-dim hover:text-foreground hover:border-studio-metal-light"
        >
          Cancel
        </button>
      </div>
    </div>
  </StudioModal>
);

/* ------------------------------------------------------------------ */
/*  Unsaved Changes Warning Modal                                     */
/* ------------------------------------------------------------------ */

export const UnsavedChangesModal = ({ open, onClose }: ModalProps) => (
  <StudioModal open={open} onClose={onClose} title="Unsaved Changes" icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />} width="380px">
    <div className="space-y-4">
      <p className="text-xs text-studio-text-dim text-center leading-relaxed">
        You have unsaved changes. Would you like to save before continuing?
      </p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-studio-teal/40 bg-studio-teal/15 text-studio-teal hover:bg-studio-teal/25"
        >
          Save
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-red-400/40 bg-red-400/10 text-red-400 hover:bg-red-400/20"
        >
          Discard
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-border bg-studio-metal text-studio-text-dim hover:text-foreground hover:border-studio-metal-light"
        >
          Cancel
        </button>
      </div>
    </div>
  </StudioModal>
);
