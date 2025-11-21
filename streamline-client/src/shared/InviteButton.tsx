type Role = "host" | "moderator" | "participant";

type Props = {
  roomName: string;
  /** Optional role for the invite link. Defaults to "participant". */
  role?: Role;
  /** Optional custom button text. Defaults to "Invite". */
  label?: string;
};

export default function InviteButton({ roomName, role = "participant", label }: Props) {
  const inviteUrl = `${window.location.origin}/room/${encodeURIComponent(
    roomName
  )}?role=${encodeURIComponent(role)}`;

  async function handleInvite() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my StreamLine room",
          text: `Join the room: ${roomName}`,
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        alert("Invite link copied to clipboard!");
      }
    } catch {
      // Fallback copy if share fails or clipboard is blocked
      try {
        await navigator.clipboard.writeText(inviteUrl);
        alert("Invite link copied to clipboard!");
      } catch {
        prompt("Copy this invite URL:", inviteUrl);
      }
    }
  }

  return (
    <button
      onClick={handleInvite}
      className="rounded-xl px-4 py-2 font-medium shadow border"
      title="Invite someone to this room"
    >
      {label ?? "Invite"}
    </button>
  );
}
