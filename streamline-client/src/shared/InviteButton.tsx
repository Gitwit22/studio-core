type Props = { roomName: string };

export default function InviteButton({ roomName }: Props) {
  const inviteUrl = `${window.location.origin}/room/${encodeURIComponent(roomName)}`;

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
      Invite
    </button>
  );
}
