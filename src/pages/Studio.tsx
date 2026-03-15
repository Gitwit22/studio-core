import { useState, useEffect } from "react";
import MenuBar from "@/components/studio/MenuBar";
import ConsoleBar from "@/components/studio/ConsoleBar";
import ChannelStrips from "@/components/studio/ChannelStrips";
import Timeline from "@/components/studio/Timeline";
import TransportControls from "@/components/studio/TransportControls";
import FXRack from "@/components/studio/FXRack";
import ExportModal from "@/components/studio/ExportModal";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import "@/studio/commands/transportCommands";
import { registerStudioShortcuts } from "@/studio/registerShortcuts";

const Studio = () => {
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    const cleanup = registerStudioShortcuts();
    return cleanup;
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
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

      {/* Export Modal */}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
};

export default Studio;
