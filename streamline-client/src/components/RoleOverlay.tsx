import React from "react";
import { useParticipants } from "@livekit/components-react";

type Role = "host" | "moderator" | "participant";

export default function RoleOverlay({
  open,
  onClose,
  role,
  roomName,
}: {
  open: boolean;
  onClose: () => void;
  role: Role;
  roomName: string;
}) {
  if (!open) return null;

  return (
    // Overlay anchored to the whole room area
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={onClose}
      />

      {/* Right-side drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-[420px] bg-white shadow-xl flex flex-col pointer-events-auto">
        <header className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold">
            Dashboard{" "}
            <span className="opacity-60 text-sm">({role})</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 border text-sm"
          >
            Close
          </button>
        </header>

        <div className="p-3 flex-1 overflow-y-auto space-y-6">
          {role === "host" && <HostPanel roomName={roomName} />}
          {role === "moderator" && <ModeratorPanel roomName={roomName} />}
          {role === "participant" && <ParticipantPanel roomName={roomName} />}
        </div>
      </div>
    </div>
  );
}

function HostPanel({ roomName }: { roomName: string }) {
  const parts = useParticipants();
  return (
    <>
      <Section title="Live Participants">
        <ParticipantList
          participants={parts}
          onMute={(id, muted) => apiMute(roomName, id, muted)}
          onRemove={(id) => apiRemove(roomName, id)}
          canModerate
        />

        {/* Mute / Unmute all controls */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-md border px-2 py-1 text-[11px]"
            onClick={() => apiMuteAll(roomName, true)}
          >
            Mute all
          </button>
          <button
            className="rounded-md border px-2 py-1 text-[11px]"
            onClick={() => apiMuteAll(roomName, false)}
          >
            Unmute all
          </button>
        </div>
      </Section>

      <Section title="Greenroom (Coming Soon)">
        <p className="text-sm opacity-70">
          Admit/Reject guests from a separate lobby room.
        </p>
      </Section>

      <Section title="Overlays (MVP)">
        <div className="flex gap-2">
          <button
            className="rounded-lg border px-3 py-1 text-sm"
            onClick={() => alert("Show lower-third (stub)")}
          >
            Show Lower Third
          </button>
          <button
            className="rounded-lg border px-3 py-1 text-sm"
            onClick={() => alert("Hide lower-third (stub)")}
          >
            Hide
          </button>
        </div>
      </Section>
    </>
  );
}

function ModeratorPanel({ roomName }: { roomName: string }) {
  const parts = useParticipants();
  return (
    <>
      <Section title="Moderation">
        <p className="text-sm opacity-70">
          Mute/Remove participants. Host defines permissions.
        </p>
      </Section>
      <Section title="Live Participants">
        <ParticipantList
          participants={parts}
          onMute={(id, muted) => apiMute(roomName, id, muted)}
          onRemove={(id) => apiRemove(roomName, id)}
          canModerate
        />
      </Section>
    </>
  );
}

function ParticipantPanel({ roomName }: { roomName: string }) {
  return (
    <>
      <Section title="Info">
        <p className="text-sm opacity-80">
          You’re in <b>{roomName}</b>. Use the control bar to toggle mic/cam or
          share your screen.
        </p>
      </Section>
      <Section title="Tips">
        <ul className="list-disc pl-5 text-sm opacity-80">
          <li>Use headphones to avoid echo.</li>
          <li>Mute when not speaking.</li>
          <li>Use chat for links and quick notes.</li>
        </ul>
      </Section>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">{title}</div>
      <div className="rounded-xl border p-3 bg-white">{children}</div>
    </div>
  );
}

function ParticipantList({
  participants,
  canModerate,
  onMute,
  onRemove,
}: {
  participants: ReturnType<typeof useParticipants>;
  canModerate?: boolean;
  onMute?: (identity: string, muted: boolean) => void;
  onRemove?: (identity: string) => void;
}) {
  if (!participants?.length) {
    return <p className="text-sm opacity-70">No one here yet.</p>;
  }

  return (
    <div className="space-y-2">
      {participants.map((p) => (
        <div
          key={p.identity}
          className="flex items-center justify-between rounded-lg border px-3 py-2"
        >
          <div className="text-sm">
            <div className="font-medium">{p.name || p.identity}</div>
            <div className="opacity-60 text-xs break-all">
              {p.identity}
            </div>
          </div>
          {canModerate && (
            <div className="flex gap-2">
              <button
                className="rounded-md border px-2 py-1 text-xs"
                onClick={() => onMute?.(p.identity, true)}
              >
                Mute
              </button>
              <button
                className="rounded-md border px-2 py-1 text-xs"
                onClick={() => onMute?.(p.identity, false)}
              >
                Unmute
              </button>
              <button
                className="rounded-md border px-2 py-1 text-xs"
                onClick={() => onRemove?.(p.identity)}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** --- Minimal admin calls (MVP; secure later with auth/JWT) --- */

async function apiMute(room: string, identity: string, muted: boolean) {
  try {
    const res = await fetch("/api/admin/mute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, identity, muted }),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // ignore JSON parse errors
    }

    if (!res.ok || (data && data.error)) {
      console.error("mute/unmute failed", { status: res.status, data });
      alert((data && data.error) || `Mute failed (HTTP ${res.status})`);
      return;
    }

    console.log("mute/unmute success", data);
  } catch (e) {
    console.error("mute/unmute failed (network)", e);
    alert("Mute request failed (network error)");
  }
}

async function apiMuteAll(room: string, muted: boolean) {
  try {
    const res = await fetch("/api/admin/mute-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, muted }),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // ignore JSON parse errors
    }

    if (!res.ok || (data && data.error)) {
      console.error("mute-all failed", { status: res.status, data });
      alert((data && data.error) || `Mute all failed (HTTP ${res.status})`);
      return;
    }

    console.log("mute-all success", data);
  } catch (e) {
    console.error("mute-all failed (network)", e);
    alert("Mute-all request failed (network error)");
  }
}

async function apiRemove(room: string, identity: string) {
  try {
    const res = await fetch("/api/admin/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, identity }),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // ignore JSON parse errors
    }

    if (!res.ok || (data && data.error)) {
      console.error("remove failed", { status: res.status, data });
      alert((data && data.error) || `Remove failed (HTTP ${res.status})`);
      return;
    }

    console.log("remove success", data);
  } catch (e) {
    console.error("remove failed (network)", e);
    alert("Remove request failed (network error)");
  }
}
