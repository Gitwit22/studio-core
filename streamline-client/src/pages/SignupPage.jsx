import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || ""; // same pattern as Room

export const SignupPage = () => {
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      // Save user + token locally (MVP auth)
      localStorage.setItem("sl_user", JSON.stringify(data.user));
      localStorage.setItem("sl_token", data.token);

      // Go straight to Create Room
      nav("/join");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6 text-center">
      <h2 className="text-3xl font-bold mb-6">Create Your Account</h2>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col w-full max-w-sm space-y-4"
      >
        <input
          type="text"
          placeholder="Display Name"
          className="p-3 rounded-lg bg-gray-800 text-white outline-none"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          className="p-3 rounded-lg bg-gray-800 text-white outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="p-3 rounded-lg bg-gray-800 text-white outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="bg-white text-black py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
        >
          Sign Up
        </button>
      </form>

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </div>
  );
};
