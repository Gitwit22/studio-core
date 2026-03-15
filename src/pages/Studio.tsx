import { useState, useEffect, useCallback } from "react";
import MenuBar from "@/components/studio/MenuBar";
import ConsoleBar from "@/components/studio/ConsoleBar";
import ChannelStrips from "@/components/studio/ChannelStrips";
import Timeline from "@/components/studio/Timeline";
import TransportControls from "@/components/studio/TransportControls";
import FXRack from "@/components/studio/FXRack";
import ExportModal from "@/components/studio/ExportModal";
import NewSessionDialog from "@/components/studio/NewSessionDialog";
import "@/studio/commands/transportCommands";
import "@/studio/commands/trackCommands";
import "@/studio/commands/editCommands";
import { startAutosave, stopAutosave } from "@/studio/commands/projectCommands";
import { registerStudioShortcuts } from "@/studio/registerShortcuts";
import { useStudioStore } from "@/studio/engine/studioStore";
import { audioEffectsManager } from "@/audio/AudioEffectsManager";
import { mixerEngine } from "@/audio/MixerEngine";

const Studio = () => {
  const [exportOpen, setExportOpen] = useState(false);
  const [showNewSession, setShowNewSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  const handleSessionReady = useCallback(() => {
    setSessionReady(true);
    // Boot effects chain, then mixer (mixer routes into effects)
    audioEffectsManager.init();
    mixerEngine.init();
    // Start autosave
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
      <div className="flex flex-1 overflow-hidden">
        <ChannelStrips />
        <Timeline />
        <FXRack />
      </div>

      {/* Bottom: Transport Controls */}
      <TransportControls />

      {/* Export Modal */}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
};

export default Studio;
