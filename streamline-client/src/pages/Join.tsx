import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Join() {
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [roomName, setRoomName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = displayName.trim();
    const room = roomName.trim();
    if (!name || !room) return;
    localStorage.setItem("sl_displayName", name);
    nav(`/room/${encodeURIComponent(room)}`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Your name" />
      <input value={roomName} onChange={(e)=>setRoomName(e.target.value)} placeholder="Room name" />
      <button type="submit">Enter</button>
    </form>
  );
}
