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
  NewSessionModal,
  OpenSessionModal,
  SaveSessionAsModal,
  SessionInfoModal,
  KeyboardShortcutsModal,
  QuickStartModal,
  TroubleshootingModal,
  ReportProblemModal,
  ConfirmDeleteModal,
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
    audioEffectsManager.init();
    mixerEngine.init();
    startAutosave();
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
      <NewSessionModal open={activeModal === "newSession"} onClose={closeModal} />
      <OpenSessionModal open={activeModal === "openSession"} onClose={closeModal} />
      <SaveSessionAsModal open={activeModal === "saveSessionAs"} onClose={closeModal} />
      <SessionInfoModal open={activeModal === "sessionInfo"} onClose={closeModal} />
      <KeyboardShortcutsModal open={activeModal === "keyboardShortcuts"} onClose={closeModal} />
      <QuickStartModal open={activeModal === "quickStart"} onClose={closeModal} />
      <TroubleshootingModal open={activeModal === "troubleshooting"} onClose={closeModal} />
      <ReportProblemModal open={activeModal === "reportProblem"} onClose={closeModal} />
      <ConfirmDeleteModal open={activeModal === "confirmDelete"} onClose={closeModal} />
      <UnsavedChangesModal open={activeModal === "unsavedChanges"} onClose={closeModal} />
    </div>
  );
};

export default Studio;
