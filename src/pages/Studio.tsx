import { useState, useEffect } from "react";
import TopMenu from "@/components/studio/TopMenu";
import ConsoleBar from "@/components/studio/ConsoleBar";
import ChannelStrips from "@/components/studio/ChannelStrips";
import Timeline from "@/components/studio/Timeline";
import TransportControls from "@/components/studio/TransportControls";
import FXRack from "@/components/studio/FXRack";
import ExportModal from "@/components/studio/ExportModal";
import "@/studio/commands/transportCommands";
import { registerStudioShortcuts } from "@/studio/registerShortcuts";

const Studio = () => {
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    registerStudioShortcuts();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* DAW Menu Bar */}
      <TopMenu onExport={() => setExportOpen(true)} />

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
