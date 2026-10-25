import { useEffect, useState } from "react";
import {
  SaveAll,
  FileText,
  Keyboard,
  Rocket,
  Wrench,
  AlertTriangle,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import * as Tone from "tone";
import { toast } from "sonner";
import StudioModal from "./StudioModal";
import { useStudioStore } from "@/studio/engine/studioStore";
import { persistenceService } from "@/studio/persistence";
import { audioEngine } from "@/audio/AudioEngine";
import { closeSession } from "@/studio/commands/projectCommands";

const ModalActions = ({
  primaryLabel,
  onPrimary,
  onCancel,
  primaryDisabled = false,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  onCancel: () => void;
  primaryDisabled?: boolean;
}) => (
  <div className="flex gap-3 pt-4">
    <button
      onClick={onPrimary}
      disabled={primaryDisabled}
      className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-studio-teal/40 bg-studio-teal/15 text-studio-teal hover:bg-studio-teal/25 disabled:opacity-50 disabled:cursor-not-allowed"
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

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 text-xs py-1.5 px-3 rounded bg-studio-metal/50">
    <span className="text-studio-text-dim shrink-0">{label}</span>
    <span className="text-foreground font-mono text-right truncate">{value}</span>
  </div>
);

const fieldLabelClass = "text-[10px] uppercase tracking-widest text-studio-text-dim font-semibold mb-2 block";
const inputClass =
  "w-full bg-studio-metal border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-studio-teal/50 transition-colors";

function errorDescription(err: unknown): string | undefined {
  return err instanceof Error ? err.message : undefined;
}

/* ------------------------------------------------------------------ */
/*  Modal Props                                                       */
/* ------------------------------------------------------------------ */

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Save Session As Modal                                             */
/* ------------------------------------------------------------------ */

/** Saves the session (with unsaved edits) as a new project and switches to it. */
export const SaveSessionAsModal = ({ open, onClose }: ModalProps) => {
  const projectName = useStudioStore((s) => s.projectName);
  const [name, setName] = useState("");
  const [parentDir, setParentDir] = useState<FileSystemDirectoryHandle | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(`${projectName} Copy`);
    setParentDir(undefined);
    // Only reset when the modal opens, not on later store changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const location = open ? persistenceService.storageLocation : null;
  const isFileSystem = location?.kind === "filesystem";

  const chooseFolder = async () => {
    try {
      setParentDir(await window.showDirectoryPicker({ mode: "readwrite" }));
    } catch {
      // picker cancelled
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await persistenceService.saveAsCopy(trimmed, parentDir);
      toast.success(`Saved as "${useStudioStore.getState().projectName}"`);
      onClose();
    } catch (err) {
      console.warn("Save As failed:", err);
      toast.error("Save As failed", { description: errorDescription(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StudioModal open={open} onClose={onClose} title="Save Session As" icon={<SaveAll className="w-4 h-4 text-studio-teal" />}>
      {!location ? (
        <p className="text-xs text-studio-text-dim text-center py-4">No session is open.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className={fieldLabelClass}>New Session Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
              className={inputClass}
              autoFocus
            />
          </div>
          {isFileSystem && (
            <div>
              <label className={fieldLabelClass}>Save In Folder</label>
              <button
                onClick={chooseFolder}
                className="w-full flex items-center gap-2 bg-studio-metal border border-border rounded px-3 py-2 text-xs text-studio-text-dim hover:text-foreground transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {parentDir ? parentDir.name : "Choose folder…"}
              </button>
            </div>
          )}
          <p className="text-[11px] text-studio-text-dim leading-relaxed">
            Creates a separate copy (including its audio) and continues in the copy.
            &ldquo;{projectName}&rdquo; stays as it was last saved.
          </p>
          <ModalActions
            primaryLabel={saving ? "Saving…" : "Save Copy"}
            onPrimary={handleSave}
            onCancel={onClose}
            primaryDisabled={saving || !name.trim() || (isFileSystem && !parentDir)}
          />
        </div>
      )}
    </StudioModal>
  );
};

/* ------------------------------------------------------------------ */
/*  Session Info Modal                                                */
/* ------------------------------------------------------------------ */

export const SessionInfoModal = ({ open, onClose }: ModalProps) => {
  const projectName = useStudioStore((s) => s.projectName);
  const bpm = useStudioStore((s) => s.bpm);
  const trackCount = useStudioStore((s) => s.tracks.length);
  const clipCount = useStudioStore((s) => s.clips.length);
  const sourceCount = useStudioStore((s) => s.sources.length);
  const isDirty = useStudioStore((s) => s.isDirty);

  if (!open) return null;
  const location = persistenceService.storageLocation;
  const lastSavedAt = persistenceService.lastSavedAt;
  const sampleRate = audioEngine.contextStarted ? `${Tone.getContext().sampleRate} Hz` : "Starts on first playback";

  return (
    <StudioModal open={open} onClose={onClose} title="Session Info" icon={<FileText className="w-4 h-4 text-studio-teal" />}>
      <div className="space-y-3">
        <InfoRow label="Session Name" value={projectName} />
        <InfoRow label="Stored In" value={location?.label ?? "Not saved"} />
        <InfoRow label="Last Saved" value={lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "Never"} />
        <InfoRow label="Unsaved Changes" value={isDirty ? "Yes" : "No"} />
        <InfoRow label="BPM" value={bpm} />
        <InfoRow label="Tracks" value={trackCount} />
        <InfoRow label="Clips" value={clipCount} />
        <InfoRow label="Audio Files" value={sourceCount} />
        <InfoRow label="Engine Sample Rate" value={sampleRate} />
      </div>
    </StudioModal>
  );
};

/* ------------------------------------------------------------------ */
/*  Keyboard Shortcuts Modal                                          */
/* ------------------------------------------------------------------ */

const shortcutList = [
  { key: "Space", desc: "Play / Pause" },
  { key: "R", desc: "Record" },
  { key: "Ctrl+S", desc: "Save Session" },
  { key: "Ctrl+Shift+S", desc: "Save Session As" },
  { key: "Ctrl+Z", desc: "Undo" },
  { key: "Ctrl+Shift+Z", desc: "Redo" },
  { key: "Ctrl+N", desc: "New Session" },
  { key: "Ctrl+X", desc: "Cut" },
  { key: "Ctrl+C", desc: "Copy" },
  { key: "Ctrl+V", desc: "Paste" },
  { key: "Ctrl+D", desc: "Duplicate Clip" },
  { key: "Del", desc: "Delete Clip" },
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
        { q: "No audio input detected", a: "Check that your microphone is connected and browser permissions are granted. Try Settings → Audio → Reconnect Devices, then Test Mic." },
        { q: "Playback is stuttering", a: "Close other browser tabs and applications. If it persists, use Settings → Audio → Reset Audio Engine." },
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

function buildProblemReport(description: string): string {
  const s = useStudioStore.getState();
  return [
    "StreamLine Studio — problem report",
    `Time: ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
    `Storage: ${persistenceService.storageLocation?.label ?? "No session open"}`,
    `Tracks: ${s.tracks.length}, Clips: ${s.clips.length}, Audio files: ${s.sources.length}, BPM: ${s.bpm}`,
    `Playing: ${s.isPlaying}, Recording: ${s.isRecording}, Unsaved changes: ${s.isDirty}`,
    "",
    "What happened:",
    description.trim() || "(no description)",
  ].join("\n");
}

/**
 * There is no problem-report backend, so the report (description + basic
 * diagnostics, no audio or session content) is copied for the user to send.
 */
export const ReportProblemModal = ({ open, onClose }: ModalProps) => {
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) setDescription("");
  }, [open]);

  const handleCopy = async () => {
    const report = buildProblemReport(description);
    try {
      await navigator.clipboard.writeText(report);
      toast.success("Report copied — paste it into an email or issue");
      onClose();
    } catch (err) {
      toast.error("Could not copy the report", { description: errorDescription(err) });
    }
  };

  return (
    <StudioModal open={open} onClose={onClose} title="Report Problem" icon={<AlertCircle className="w-4 h-4 text-studio-teal" />}>
      <div className="space-y-4">
        <div>
          <label className={fieldLabelClass}>Describe the Issue</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened?"
            className={`${inputClass} resize-none`}
          />
        </div>
        <p className="text-[11px] text-studio-text-dim leading-relaxed">
          Copies your description plus browser and session stats (no audio or session content) to the clipboard.
        </p>
        <ModalActions primaryLabel="Copy Report" onPrimary={handleCopy} onCancel={onClose} />
      </div>
    </StudioModal>
  );
};

/* ------------------------------------------------------------------ */
/*  Unsaved Changes Warning Modal (shown by File → Close Session)     */
/* ------------------------------------------------------------------ */

export const UnsavedChangesModal = ({ open, onClose }: ModalProps) => {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistenceService.save();
      closeSession();
    } catch (err) {
      console.warn("Save before close failed:", err);
      toast.error("Save failed — session not closed", { description: errorDescription(err) });
      setSaving(false);
    }
  };

  return (
    <StudioModal open={open} onClose={onClose} title="Unsaved Changes" icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />} width="380px">
      <div className="space-y-4">
        <p className="text-xs text-studio-text-dim text-center leading-relaxed">
          This session has changes that are not saved yet. Save before closing?
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-studio-teal/40 bg-studio-teal/15 text-studio-teal hover:bg-studio-teal/25 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => closeSession()}
            disabled={saving}
            className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-red-400/40 bg-red-400/10 text-red-400 hover:bg-red-400/20 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all border border-border bg-studio-metal text-studio-text-dim hover:text-foreground hover:border-studio-metal-light disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </StudioModal>
  );
};
