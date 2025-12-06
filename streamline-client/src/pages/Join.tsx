import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UsageBanner from "../components/UsageBanner";


const raw = localStorage.getItem("sl_user");
const user = raw ? JSON.parse(raw) : null;

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6">
       <UsageBanner />

      {/* Top right corner - Dashboard button */}
      <div className="fixed top-4 right-4">
        <button
          onClick={() => nav("/dashboard")}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition"
        >
          📊 Dashboard
        </button>
      </div>

      {/* 🔥 WELCOME BACK BANNER */}
      {user && (
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold">
            Welcome back, {user.displayName || user.email} 👋
          </h2>

          {/* Optional: show their onboarding defaults */}
          {user.defaultResolution && (
            <p className="text-sm text-gray-400">
              Default resolution: {user.defaultResolution}
            </p>
          )}
        </div>
      )}

{/* 🔥 ONBOARDING COMPLETION SECTION */}
{user && !user.onboardingCompleted && (
  <div className="w-full max-w-md bg-gray-900 p-4 rounded-lg mb-6">
    <h3 className="text-lg font-semibold mb-2">Finish Your Streaming Setup</h3>
    <p className="text-sm text-gray-400 mb-4">
      You skipped streaming setup during signup. Connect your destinations
      here to make going live even faster.
    </p>

    {/* YouTube Button */}
    {!user.youtubeConnected && (
      <button
        type="button"
        className="w-full py-2 bg-red-600 hover:bg-red-700 rounded mb-3"
        onClick={() => alert("YouTube OAuth coming soon")}
      >
        Connect YouTube
      </button>
    )}

    {/* Facebook Button */}
    {!user.facebookConnected && (
      <button
        type="button"
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded"
        onClick={() => alert("Facebook OAuth coming soon")}
      >
        Connect Facebook
      </button>

      
    )}
  </div>
)}




      {/* Your existing form */}
      <form onSubmit={handleSubmit}>

        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          className="p-2 rounded mb-3 text-black"
        />

        <input
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="Room name"
          className="p-2 rounded mb-3 text-black"
        />

        <button type="submit" className="bg-white text-black py-2 px-4 rounded">
          Enter Room
        </button>

      </form>

      <button
  onClick={() => {
    localStorage.removeItem("sl_displayName");
    window.location.href = "/"; // guaranteed redirect
  }}
  className="text-xs px-3 py-1 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition"
>
  Logout
</button>

    </div>
  );
}
