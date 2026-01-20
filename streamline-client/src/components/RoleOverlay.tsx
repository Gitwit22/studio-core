import React from "react";
import { useParticipants, useLocalParticipant } from "@livekit/components-react";

// Normalize API base to avoid trailing slashes that cause "//api/..." URLs
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

type Role = "host" | "moderator" | "participant";
type RolePresetId = "participant" | "cohost" | "moderator";

export default function RoleOverlay({
  open,
  onClose,
  role,
  roomName,
  roomId,
  roomAccessToken,
  canMuteGuests,
  advancedRolesEnabled,
}: {
  open: boolean;
  onClose: () => void;
  role: Role;
  roomName: string;
  roomId: string;
  roomAccessToken: string;
  canMuteGuests?: boolean;
  advancedRolesEnabled?: boolean;
}) {
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '20px',
      zIndex: 9999,
      pointerEvents: 'auto'
    }}>
      {/* Floating Menu Card */}
      <div style={{
        background: 'rgba(20, 20, 20, 0.98)',
        borderRadius: '0.75rem',
        border: '1px solid rgba(220, 38, 38, 0.5)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px rgba(220, 38, 38, 0.2)',
        width: '420px',
        maxHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#ffffff'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem',
          borderBottom: '2px solid rgba(220, 38, 38, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(239, 68, 68, 0.05))'
        }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#ef4444', letterSpacing: '0.5px' }}>
              {role === 'host' ? 'DASHBOARD' : role.toUpperCase()}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(220, 38, 38, 0.2)',
              border: '1px solid rgba(220, 38, 38, 0.5)',
              borderRadius: '0.375rem',
              color: '#ef4444',
              padding: '0.4rem 0.6rem',
              cursor: 'pointer',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              transition: 'all 0.3s ease',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'rgba(220, 38, 38, 0.4)';
              target.style.borderColor = 'rgba(220, 38, 38, 0.8)';
              target.style.boxShadow = '0 0 15px rgba(220, 38, 38, 0.3)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'rgba(220, 38, 38, 0.2)';
              target.style.borderColor = 'rgba(220, 38, 38, 0.5)';
              target.style.boxShadow = 'none';
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '1rem',
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {role === "host" && (
            <HostPanel
              roomName={roomName}
              roomId={roomId}
              roomAccessToken={roomAccessToken}
              canMuteGuests={canMuteGuests}
              advancedRolesEnabled={advancedRolesEnabled}
            />
          )}
          {role === "moderator" && <ModeratorPanel roomName={roomName} canMuteGuests={canMuteGuests} />}
          {role === "participant" && <ParticipantPanel roomName={roomName} />}
        </div>
      </div>
    </div>
  );

}

function HostPanel({
  roomName,
  roomId,
  roomAccessToken,
  canMuteGuests,
  advancedRolesEnabled,
}: {
  roomName: string;
  roomId: string;
  roomAccessToken: string;
  canMuteGuests?: boolean;
  advancedRolesEnabled?: boolean;
}) {
  const parts = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [muteLock, setMuteLock] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [roleToast, setRoleToast] = React.useState<string | null>(null);
  const roleToastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [roleOverrides, setRoleOverrides] = React.useState<Record<string, RolePresetId>>({});
  const [roleStatus, setRoleStatus] = React.useState<Record<string, "saving" | "saved">>({});

  // Load initial muteLock state for this room
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/roomSettings/${encodeURIComponent(roomName)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMuteLock(!!data.muteLock);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomName]);

  const handleMuteAllExceptHost = async () => {
    if (!roomName) return;
    setBusy(true);
    try {
      await apiMuteAll(roomName, true);
      const hostId = localParticipant?.identity;
      if (hostId) {
        await apiMute(roomName, hostId, false);
      }
    } catch (e) {
      console.error("mute-all-except-host failed", e);
      alert("Failed to mute all participants");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMuteLock = async () => {
    const next = !muteLock;
    setBusy(true);
    try {
      if (next) {
        // When enabling lock, first mute everyone except host
        await handleMuteAllExceptHost();
      }
      const hostId = localParticipant?.identity;
      const res = await apiSetMuteLock(roomName, next, hostId);
      setMuteLock(!!res.muteLock);
    } catch (e) {
      console.error("mute-lock toggle failed", e);
      alert("Failed to update mute lock");
    } finally {
      setBusy(false);
    }
  };

  const handleChangeRole = async (identity: string, presetId: RolePresetId) => {
    if (!roomId || !roomAccessToken) return;

    setRoleOverrides((prev) => ({ ...prev, [identity]: presetId }));
    setRoleStatus((prev) => ({ ...prev, [identity]: "saving" }));

    try {
      await apiSetRole(roomId, roomAccessToken, identity, presetId);
      setRoleStatus((prev) => ({ ...prev, [identity]: "saved" }));

      // Show a small global toast inside the dashboard for extra feedback.
      setRoleToast("Role updated");
      if (roleToastTimeoutRef.current) {
        clearTimeout(roleToastTimeoutRef.current);
      }
      roleToastTimeoutRef.current = setTimeout(() => {
        setRoleToast(null);
        roleToastTimeoutRef.current = null;
      }, 2000);

      // Clear the "Saved" label after a short delay; underlying metadata will reflect the change.
      setTimeout(() => {
        setRoleStatus((prev) => {
          const next = { ...prev };
          if (next[identity] === "saved") {
            delete next[identity];
          }
          return next;
        });
      }, 1500);
    } catch (e: any) {
      console.error("role change failed", e);
      alert(e?.message || "Role change failed");
      setRoleOverrides((prev) => {
        const next = { ...prev };
        delete next[identity];
        return next;
      });
      setRoleStatus((prev) => {
        const next = { ...prev };
        delete next[identity];
        return next;
      });
    }
  };
  return (
    <>
      <Section title="Live Participants">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
          <button
            onClick={handleMuteAllExceptHost}
            disabled={busy}
            style={{
              flex: 1,
              borderRadius: '0.375rem',
              border: '1px solid rgba(220, 38, 38, 0.6)',
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              background: busy ? 'rgba(220, 38, 38, 0.4)' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: '#ffffff',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            {busy ? "Muting..." : "Mute All Except Host"}
          </button>
          <button
            onClick={handleToggleMuteLock}
            disabled={busy}
            style={{
              borderRadius: '9999px',
              border: muteLock ? '1px solid rgba(220, 38, 38, 0.9)' : '1px solid rgba(148, 163, 184, 0.7)',
              padding: '0.25rem 0.75rem',
              fontSize: '0.7rem',
              background: muteLock ? 'rgba(220, 38, 38, 0.2)' : 'rgba(31, 41, 55, 0.5)',
              color: muteLock ? '#fecaca' : '#e5e7eb',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '9999px',
              background: muteLock ? '#ef4444' : '#9ca3af'
            }} />
            {muteLock ? 'Mute Lock On' : 'Mute Lock Off'}
          </button>
        </div>
        <ParticipantList
          participants={parts}
          onRemove={(id) => apiRemove(roomName, id)}
          onMute={(id, muted) => apiMute(roomName, id, muted)}
          canModerate
          muteLock={muteLock}
          localIdentity={localParticipant?.identity || null}
          canMuteGuests={canMuteGuests}
          canChangeRoles={!!advancedRolesEnabled && !!roomId && !!roomAccessToken}
          onChangeRole={handleChangeRole}
          roleOverrides={roleOverrides}
          roleStatus={roleStatus}
        />

        {muteLock && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'rgba(248, 250, 252, 0.7)' }}>
            🔒 Mute lock is on. Participants stay muted until you turn this off.
          </p>
        )}
      </Section>

      {roleToast && (
        <div
          style={{
            marginTop: '0.75rem',
            fontSize: '0.75rem',
            borderRadius: '9999px',
            padding: '0.35rem 0.75rem',
            alignSelf: 'flex-start',
            background: 'rgba(22, 163, 74, 0.12)',
            border: '1px solid rgba(22, 163, 74, 0.6)',
            color: '#bbf7d0',
          }}
        >
          {roleToast}
        </div>
      )}

      <Section title="Greenroom (Coming Soon)">
        <p style={{ fontSize: '0.875rem', opacity: 0.7, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
          Admit/Reject guests from a separate lobby room.
        </p>
      </Section>

      <Section title="Overlays (MVP)">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            style={{
              borderRadius: '0.375rem',
              border: '1px solid rgba(220, 38, 38, 0.5)',
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontWeight: '600'
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'linear-gradient(135deg, #b91c1c, #991b1b)';
              target.style.boxShadow = '0 0 10px rgba(220, 38, 38, 0.3)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)';
              target.style.boxShadow = 'none';
            }}
            onClick={() => alert("Show lower-third (stub)")}
          >
            Show Lower Third
          </button>
          <button
            style={{
              borderRadius: '0.375rem',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              background: 'rgba(75, 85, 99, 0.2)',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontWeight: '600'
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'rgba(75, 85, 99, 0.4)';
              target.style.borderColor = 'rgba(75, 85, 99, 0.8)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'rgba(75, 85, 99, 0.2)';
              target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
            }}
            onClick={() => alert("Hide lower-third (stub)")}
          >
            Hide
          </button>
        </div>
      </Section>
    </>
  );
}

function ModeratorPanel({ roomName, canMuteGuests }: { roomName: string; canMuteGuests?: boolean }) {
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
          onRemove={(id) => apiRemove(roomName, id)}
          onMute={(id, muted) => apiMute(roomName, id, muted)}
          canModerate
          canMuteGuests={canMuteGuests}
        />
      </Section>
    </>
  );
}

function ParticipantPanel({ roomName }: { roomName: string }) {
  const { localParticipant } = useLocalParticipant();
  const roleLabel = (() => {
    const name = (localParticipant as any)?.identityMetadata?.rolePresetId as
      | "participant"
      | "cohost"
      | "moderator"
      | undefined;
    if (name === "cohost") return "You are a Co-host";
    if (name === "moderator") return "You are a Moderator";
    if (name === "participant") return "You are a Participant";
    return null;
  })();
  return (
    <>
      <Section title="Info">
        <p style={{ fontSize: '0.875rem', opacity: 0.8, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.5 }}>
          You're in <b>{roomName}</b>. Use the control bar to toggle mic/cam or
          share your screen.
        </p>
        {roleLabel && (
          <p style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'rgba(248, 250, 252, 0.85)' }}>
            {roleLabel}
          </p>
        )}
      </Section>
      <Section title="Tips">
        <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', fontSize: '0.875rem', opacity: 0.8, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.6 }}>
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
      <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
      <div style={{ borderRadius: '0.375rem', border: '1px solid rgba(220, 38, 38, 0.2)', padding: '0.75rem', background: 'rgba(31, 41, 55, 0.3)', color: 'rgba(255, 255, 255, 0.9)' }}>{children}</div>
    </div>
  );
}

function ParticipantList({
  participants,
  canModerate,
  onRemove,
  onMute,
  muteLock,
  localIdentity,
  canMuteGuests,
  canChangeRoles,
  onChangeRole,
  roleOverrides,
  roleStatus,
}: {
  participants: ReturnType<typeof useParticipants>;
  canModerate?: boolean;
  onRemove?: (identity: string) => void;
  onMute?: (identity: string, muted: boolean) => void;
  muteLock?: boolean;
  localIdentity?: string | null;
  canMuteGuests?: boolean;
  canChangeRoles?: boolean;
  onChangeRole?: (identity: string, presetId: RolePresetId) => void;
  roleOverrides?: Record<string, RolePresetId>;
  roleStatus?: Record<string, "saving" | "saved">;
}) {
  if (!participants?.length) {
    return <p style={{ fontSize: '0.875rem', opacity: 0.7, color: 'rgba(255, 255, 255, 0.7)' }}>No one here yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {participants.map((p) => (
        <div
          key={p.identity}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: '0.375rem',
            border: '1px solid rgba(75, 85, 99, 0.3)',
            padding: '0.5rem',
            background: 'rgba(31, 41, 55, 0.2)',
            gap: '0.5rem'
          }}
        >
          <div style={{ fontSize: '0.875rem', flex: 1 }}>
            <div style={{ fontWeight: '600', color: '#ffffff' }}>{p.name || p.identity}</div>
            <div style={{ opacity: 0.6, fontSize: '0.75rem', wordBreak: 'break-all', color: 'rgba(255, 255, 255, 0.6)' }}>
              {p.identity}
            </div>
            {(() => {
              const effectiveRole = (roleOverrides && roleOverrides[p.identity]) || (p as any)?.metadata?.rolePresetId;
              if (!effectiveRole) return null;
              return (
                <div style={{ marginTop: '0.15rem', fontSize: '0.7rem', color: 'rgba(129, 140, 248, 0.9)' }}>
                  Role: {effectiveRole === 'cohost' ? 'Co-host' : effectiveRole === 'moderator' ? 'Moderator' : 'Participant'}
                </div>
              );
            })()}
          </div>
          {canModerate && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
            >
              {canChangeRoles && onChangeRole && localIdentity && p.identity !== localIdentity && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                  <select
                    value={
                      ((roleOverrides && roleOverrides[p.identity]) || (p as any)?.metadata?.rolePresetId || 'participant') as RolePresetId
                    }
                    onChange={(e) => onChangeRole(p.identity, e.target.value as RolePresetId)}
                    style={{
                      borderRadius: '9999px',
                      border: '1px solid rgba(148, 163, 184, 0.75)',
                      padding: '0.2rem 0.7rem',
                      fontSize: '0.7rem',
                      background: 'radial-gradient(circle at top left, rgba(30, 64, 175, 0.5), rgba(15, 23, 42, 0.95))',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                      minWidth: '7.5rem',
                    }}
                  >
                    <option value="participant">Participant</option>
                    <option value="cohost">Co-host</option>
                    <option value="moderator">Moderator</option>
                  </select>
                  {roleStatus && roleStatus[p.identity] === 'saving' && (
                    <span style={{ fontSize: '0.65rem', color: 'rgba(148, 163, 184, 0.9)' }}>Saving…</span>
                  )}
                  {roleStatus && roleStatus[p.identity] === 'saved' && (
                    <span style={{ fontSize: '0.65rem', color: 'rgba(34, 197, 94, 0.9)' }}>Saved</span>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                {canMuteGuests !== false && (() => {
                  const micEnabled = (p as any).isMicrophoneEnabled as boolean | undefined;
                  const isMuted = micEnabled === false;
                  const nextMuted = !isMuted; // true to mute, false to unmute

                  return (
                    <button
                      style={{
                        borderRadius: '0.25rem',
                        border: '1px solid rgba(148, 163, 184, 0.6)',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.7rem',
                        background: muteLock ? 'rgba(55, 65, 81, 0.6)' : 'rgba(31, 41, 55, 0.9)',
                        color: '#e5e7eb',
                        cursor: muteLock ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        fontWeight: '600',
                        opacity: muteLock ? 0.6 : 1
                      }}
                      disabled={muteLock}
                      onClick={() => {
                        if (muteLock) return;
                        onMute?.(p.identity, nextMuted);
                      }}
                    >
                      {isMuted ? 'Unmute' : 'Mute'}
                    </button>
                  );
                })()}
                <button
                  style={{
                    borderRadius: '0.25rem',
                    border: '1px solid rgba(220, 38, 38, 0.5)',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.7rem',
                    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    fontWeight: '600'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.target as HTMLButtonElement;
                    target.style.background = 'linear-gradient(135deg, #b91c1c, #991b1b)';
                    target.style.boxShadow = '0 0 8px rgba(220, 38, 38, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.target as HTMLButtonElement;
                    target.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)';
                    target.style.boxShadow = 'none';
                  }}
                  onClick={() => onRemove?.(p.identity)}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

async function apiRemove(room: string, identity: string) {
  try {
    const res = await fetch(`${API_BASE}/api/roomModeration/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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

async function apiMute(room: string, identity: string, muted: boolean) {
  try {
    const res = await fetch(`${API_BASE}/api/roomModeration/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ room, identity, muted }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || (data && data.error)) {
      console.error("mute failed", { status: res.status, data });
      alert((data && data.error) || `Mute failed (HTTP ${res.status})`);
      return;
    }
  } catch (e) {
    console.error("mute failed (network)", e);
    alert("Mute request failed (network error)");
  }
}

async function apiMuteAll(room: string, muted: boolean) {
  try {
    const res = await fetch(`${API_BASE}/api/roomModeration/mute-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ room, muted }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || (data && data.error)) {
      console.error("mute-all failed", { status: res.status, data });
      alert((data && data.error) || `Mute-all failed (HTTP ${res.status})`);
      return;
    }
  } catch (e) {
    console.error("mute-all failed (network)", e);
    alert("Mute-all request failed (network error)");
  }
}

async function apiSetMuteLock(
  room: string,
  muteLock: boolean,
  hostIdentity?: string | null
): Promise<{ muteLock: boolean }> {
  const res = await fetch(`${API_BASE}/api/roomModeration/mute-lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ room, muteLock, hostIdentity }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    console.error("mute-lock failed", { status: res.status, data });
    throw new Error(data.error || `Mute-lock failed (HTTP ${res.status})`);
  }
  return { muteLock: !!data.muteLock };
}

async function apiSetRole(
  roomId: string,
  roomAccessToken: string,
  identity: string,
  role: RolePresetId,
) {
  const res = await fetch(
    `${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/controls/${encodeURIComponent(identity)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${roomAccessToken}`,
      },
      credentials: "include",
      body: JSON.stringify({ role }),
    },
  );

  const data = await res.json().catch(() => null);
  if (!res.ok || (data && data.error)) {
    console.error("set-role failed", { status: res.status, data });
    throw new Error((data && data.error) || `Role change failed (HTTP ${res.status})`);
  }
}
