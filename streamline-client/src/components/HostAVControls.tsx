import { useLocalParticipant } from "@livekit/components-react";

type GuestStatus = "viewing_join" | "entered_room" | null;

export function HostAVControls({ guestStatus }: { guestStatus?: GuestStatus }) {
  const { localParticipant } = useLocalParticipant();

  if (!localParticipant) return null;

  const micOn = localParticipant.isMicrophoneEnabled;
  const camOn = localParticipant.isCameraEnabled;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={() => localParticipant.setMicrophoneEnabled(!micOn)}
        style={{
          padding: "0.5rem 1.2rem",
          borderRadius: "0.5rem",
          background: micOn ? "#dc2626" : "#374151",
          color: "#fff",
          border: "none",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s"
        }}
      >
        {micOn ? "Mute Mic" : "Unmute Mic"}
      </button>
      <button
        onClick={() => localParticipant.setCameraEnabled(!camOn)}
        style={{
          padding: "0.5rem 1.2rem",
          borderRadius: "0.5rem",
          background: camOn ? "#dc2626" : "#374151",
          color: "#fff",
          border: "none",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s"
        }}
      >
        {camOn ? "Cam Off" : "Cam On"}
      </button>
      </div>
      {guestStatus === "viewing_join" && (
        <div
          style={{
            fontSize: 12,
            color: "#e5e7eb",
            opacity: 0.9,
          }}
        >
          Guest has opened the invite link and is on the join page.
        </div>
      )}
      {guestStatus === "entered_room" && (
        <div
          style={{
            fontSize: 12,
            color: "#bbf7d0",
            opacity: 0.95,
          }}
        >
          Guest clicked Enter Room and is joining.
        </div>
      )}
    </div>
  );
}
