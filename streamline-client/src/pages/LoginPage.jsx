import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export const LoginPage = () => {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      localStorage.setItem("sl_user", JSON.stringify(data.user));
      localStorage.setItem("sl_token", data.token);
localStorage.setItem("sl_userId", data.user.id || data.user.uid);  // 🔥 add this

      // After login, go to Create Room (Join page)
      nav("/join");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6 text-center">
      <h2 className="text-3xl font-bold mb-6">Login</h2>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col w-full max-w-sm space-y-4"
      >
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
          Log In
        </button>
      </form>

      <button
        onClick={() => nav("/signup")}
        className="mt-6 text-blue-400 underline hover:text-blue-200"
      >
        Create a new account
      </button>

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </div>
  );
};
