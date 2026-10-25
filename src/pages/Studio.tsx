import { useState, useEffect, useCallback } from "react";
import MenuBar from "@/components/studio/MenuBar";
import ConsoleBar from "@/components/studio/ConsoleBar";
import ChannelStrips from "@/components/studio/ChannelStrips";
import Timeline from "@/components/studio/Timeline";
import TransportControls from "@/components/studio/TransportControls";
import FXRack from "@/components/studio/FXRack";
import ExportModal from "@/components/studio/ExportModal";
import NewSessionDialog from "@/components/studio/NewSessionDialog";
import SettingsModal from "@/components/studio/SettingsModal";
import AboutModal from "@/components/studio/AboutModal";
import {
  SaveSessionAsModal,
  SessionInfoModal,
  KeyboardShortcutsModal,
  QuickStartModal,
  TroubleshootingModal,
  ReportProblemModal,
  UnsavedChangesModal,
} from "@/components/studio/StudioModals";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import "@/studio/commands/transportCommands";
import "@/studio/commands/trackCommands";
import "@/studio/commands/editCommands";
import { startAutosave, stopAutosave } from "@/studio/commands/projectCommands";
import { registerStudioShortcuts } from "@/studio/registerShortcuts";
import { useStudioStore } from "@/studio/engine/studioStore";
import { audioEffectsManager } from "@/audio/AudioEffectsManager";
import { mixerEngine } from "@/audio/MixerEngine";

const Studio = () => {
  const [showNewSession, setShowNewSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const activeModal = useStudioStore((s) => s.activeModal);
  const closeModal = () => useStudioStore.getState().setActiveModal(null);

  const handleSessionReady = useCallback(() => {
    setSessionReady(true);
    // A New/Open request made while the launch dialog was up must not re-open it.
    useStudioStore.getState().setActiveModal(null);
    audioEffectsManager.init();
    mixerEngine.init();
    startAutosave();
  }, []);

  // Warn before leaving with edits that autosave has not written yet.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!useStudioStore.getState().isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const cleanup = registerStudioShortcuts();
    return () => {
      cleanup();
      stopAutosave();
      mixerEngine.dispose();
      audioEffectsManager.dispose();
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* New Session Dialog — shown on launch */}
      <NewSessionDialog
        open={showNewSession && !sessionReady}
        onClose={() => setShowNewSession(false)}
        onSessionReady={handleSessionReady}
      />

      {/* DAW Menu Bar */}
      <MenuBar />

      {/* Top Console Bar */}
      <ConsoleBar />

      {/* Main workspace */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        <ResizablePanel defaultSize={18} minSize={10} maxSize={35}>
          <ChannelStrips />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={62} minSize={30}>
          <Timeline />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={20} minSize={10} maxSize={35}>
          <FXRack />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Bottom: Transport Controls */}
      <TransportControls />

      {/* Modals */}
      <ExportModal open={activeModal === "exportMix"} onClose={closeModal} />
      <SettingsModal open={activeModal === "settings"} onClose={closeModal} />
      <AboutModal open={activeModal === "about"} onClose={closeModal} />
      {/* In-session New / Open use the real session dialog (saves the current session first) */}
      <NewSessionDialog
        open={sessionReady && (activeModal === "newSession" || activeModal === "openSession")}
        initialTab={activeModal === "openSession" ? "recent" : "new"}
        onClose={closeModal}
        onCancel={closeModal}
        onSessionReady={handleSessionReady}
      />
      <SaveSessionAsModal open={activeModal === "saveSessionAs"} onClose={closeModal} />
      <SessionInfoModal open={activeModal === "sessionInfo"} onClose={closeModal} />
      <KeyboardShortcutsModal open={activeModal === "keyboardShortcuts"} onClose={closeModal} />
      <QuickStartModal open={activeModal === "quickStart"} onClose={closeModal} />
      <TroubleshootingModal open={activeModal === "troubleshooting"} onClose={closeModal} />
      <ReportProblemModal open={activeModal === "reportProblem"} onClose={closeModal} />
      <UnsavedChangesModal open={activeModal === "unsavedChanges"} onClose={closeModal} />
    </div>
  );
};

export default Studio;
