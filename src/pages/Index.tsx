import ConsoleBar from "@/components/studio/ConsoleBar";
import ChannelStrips from "@/components/studio/ChannelStrips";
import Timeline from "@/components/studio/Timeline";
import TransportControls from "@/components/studio/TransportControls";
import FXRack from "@/components/studio/FXRack";

const Index = () => {
  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top Console Bar */}
      <ConsoleBar />

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Channel Strips */}
        <ChannelStrips />

        {/* Center: Timeline */}
        <Timeline />

        {/* Right: FX Rack */}
        <FXRack />
      </div>

      {/* Bottom: Transport Controls */}
      <TransportControls />
    </div>
  );
};

export default Index;
