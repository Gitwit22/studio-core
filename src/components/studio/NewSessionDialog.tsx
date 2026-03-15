import { useState, useEffect, useCallback } from "react";
import { Music, FolderOpen, Clock, Check } from "lucide-react";
import { persistenceService, recentSessions, supportsFileSystemAccess } from "@/studio/persistence";
import type { ProjectRef, NewSessionConfig } from "@/studio/persistence";

interface NewSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSessionReady: () => void;
}

const NewSessionDialog = ({ open, onClose, onSessionReady }: NewSessionDialogProps) => {
  const [tab, setTab] = useState<"new" | "recent">("new");
  const [name, setName] = useState("Untitled Session");
  const [bpm, setBpm] = useState(120);
  const [sampleRate, setSampleRate] = useState(48000);
  const [useFileSystem, setUseFileSystem] = useState(supportsFileSystemAccess());
  const [parentDirHandle, setParentDirHandle] = useState<FileSystemDirectoryHandle | undefined>();
  const [folderLabel, setFolderLabel] = useState("");
  const [recents, setRecents] = useState<ProjectRef[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    recentSessions.list().then(setRecents).catch(() => setRecents([]));
  }, [open]);

  const handleChooseFolder = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      setParentDirHandle(handle);
      setFolderLabel(handle.name);
    } catch {
      // User cancelled
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const config: NewSessionConfig = {
        name: name.trim(),
        bpm,
        sampleRate,
        useFileSystem: useFileSystem && !!parentDirHandle,
        parentDirHandle,
      };
      await persistenceService.createSession(config);
      onSessionReady();
      onClose();
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setCreating(false);
    }
  }, [name, bpm, sampleRate, useFileSystem, parentDirHandle, onSessionReady, onClose]);

  const handleOpenRecent = useCallback(async (ref: ProjectRef) => {
    setCreating(true);
    try {
      await persistenceService.openSession(ref);
      onSessionReady();
      onClose();
    } catch (err) {
      console.error("Failed to open session:", err);
    } finally {
      setCreating(false);
    }
  }, [onSessionReady, onClose]);

  const handleQuickStart = useCallback(async () => {
    setCreating(true);
    try {
      const config: NewSessionConfig = {
        name: "Untitled Session",
        bpm: 120,
        sampleRate: 48000,
        useFileSystem: false,
      };
      await persistenceService.createSession(config);
      onSessionReady();
      onClose();
    } catch (err) {
      console.error("Quick start failed:", err);
    } finally {
      setCreating(false);
    }
  }, [onSessionReady, onClose]);

  if (!open) return null;

  const sampleRates = [44100, 48000];
  const fsAvailable = supportsFileSystemAccess();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative studio-panel rounded-lg w-[480px] max-h-[85vh] overflow-y-auto shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-studio-teal" />
            <span className="text-sm font-semibold uppercase tracking-wider text-foreground">
              StreamLine Studio
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab("new")}
            className={`flex-1 py-2 text-xs uppercase tracking-wider font-medium transition-colors ${
              tab === "new"
                ? "text-studio-teal border-b-2 border-studio-teal"
                : "text-studio-text-dim hover:text-foreground"
            }`}
          >
            New Session
          </button>
          <button
            onClick={() => setTab("recent")}
            className={`flex-1 py-2 text-xs uppercase tracking-wider font-medium transition-colors ${
              tab === "recent"
                ? "text-studio-teal border-b-2 border-studio-teal"
                : "text-studio-text-dim hover:text-foreground"
            }`}
          >
            Recent Sessions {recents.length > 0 && `(${recents.length})`}
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {tab === "new" ? (
            <div className="space-y-4">
              {/* Session Name */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-studio-text-dim mb-1">
                  Session Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-studio-metal border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-studio-teal"
                  autoFocus
                />
              </div>

              {/* BPM + Sample Rate row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-wider text-studio-text-dim mb-1">
                    BPM
                  </label>
                  <input
                    type="number"
                    value={bpm}
                    onChange={(e) => setBpm(Math.max(20, Math.min(300, Number(e.target.value))))}
                    min={20}
                    max={300}
                    className="w-full bg-studio-metal border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-studio-teal"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-wider text-studio-text-dim mb-1">
                    Sample Rate
                  </label>
                  <select
                    value={sampleRate}
                    onChange={(e) => setSampleRate(Number(e.target.value))}
                    className="w-full bg-studio-metal border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-studio-teal"
                  >
                    {sampleRates.map((sr) => (
                      <option key={sr} value={sr}>
                        {(sr / 1000).toFixed(1)} kHz
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Save Location */}
              {fsAvailable && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-studio-text-dim mb-1">
                    Save Location
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUseFileSystem(!useFileSystem)}
                      className="flex items-center gap-2 text-[11px] text-studio-text-dim hover:text-foreground transition-colors"
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${
                          useFileSystem
                            ? "bg-studio-teal/20 border-studio-teal"
                            : "border-border bg-studio-metal"
                        }`}
                      >
                        {useFileSystem && <Check className="w-2.5 h-2.5 text-studio-teal" />}
                      </div>
                      Save to folder on disk
                    </button>
                  </div>

                  {useFileSystem && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={handleChooseFolder}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-studio-metal border border-border rounded text-xs text-foreground hover:border-studio-teal transition-colors"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Choose Folder
                      </button>
                      {folderLabel && (
                        <span className="text-xs text-studio-text-dim truncate">
                          {folderLabel}/
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleQuickStart}
                  disabled={creating}
                  className="text-xs text-studio-text-dim hover:text-foreground transition-colors underline"
                >
                  Quick Start (browser only)
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !name.trim()}
                  className="px-5 py-2 bg-studio-teal/20 border border-studio-teal text-studio-teal rounded text-xs uppercase tracking-wider font-medium hover:bg-studio-teal/30 transition-colors disabled:opacity-40"
                >
                  {creating ? "Creating…" : "Create Session"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {recents.length === 0 ? (
                <div className="text-center py-8 text-studio-text-dim text-xs">
                  No recent sessions found
                </div>
              ) : (
                recents.map((ref) => (
                  <button
                    key={ref.id}
                    onClick={() => handleOpenRecent(ref)}
                    disabled={creating}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded bg-studio-metal/50 border border-transparent hover:border-studio-teal/50 transition-colors text-left group"
                  >
                    <Music className="w-4 h-4 text-studio-text-dim group-hover:text-studio-teal shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">{ref.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-studio-text-dim">
                        <span>{ref.path}</span>
                        <span>•</span>
                        <Clock className="w-2.5 h-2.5 inline" />
                        <span>{new Date(ref.lastOpenedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider text-studio-text-dim">
                      {ref.adapterType === "filesystem" ? "Disk" : "Browser"}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewSessionDialog;
