import { useState, useEffect } from "react";
import MenuBar from "@/components/studio/MenuBar";
import ConsoleBar from "@/components/studio/ConsoleBar";
import ChannelStrips from "@/components/studio/ChannelStrips";
import Timeline from "@/components/studio/Timeline";
import TransportControls from "@/components/studio/TransportControls";
import FXRack from "@/components/studio/FXRack";
import ExportModal from "@/components/studio/ExportModal";
import "@/studio/commands/transportCommands";
import { registerStudioShortcuts } from "@/studio/registerShortcuts";
import { useStudioStore } from "@/studio/engine/studioStore";
import { audioEffectsManager } from "@/audio/AudioEffectsManager";

const Studio = () => {
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    // Initialize session if empty (clean start)
    const { tracks, newSession } = useStudioStore.getState();
    if (tracks.length === 0) {
      newSession();
    }
    // Boot effects chain
    audioEffectsManager.init();
    const cleanup = registerStudioShortcuts();
    return () => {
      cleanup();
      audioEffectsManager.dispose();
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
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
