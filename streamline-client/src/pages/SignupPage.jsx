import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Use relative paths - Vite proxy forwards /api/* to http://localhost:5137
const API_BASE = "";



export const SignupPage = () => {
  const nav = useNavigate();

    const [planId, setPlanId] = useState("free"); // default
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [timeZone, setTimeZone] = useState("");

  

  // Streaming defaults
  const [defaultResolution, setDefaultResolution] = useState("720p");
  const [defaultDestinations, setDefaultDestinations] = useState({
    youtube: false,
    facebook: false,
  });
  const [defaultPrivacy, setDefaultPrivacy] = useState("public");

  const [skipOnboarding, setSkipOnboarding] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Optional: auto-fill timezone using browser
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimeZone(tz || "");
    } catch {
      // ignore if not available
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body = {
        displayName,
        email,
        password,
        skipOnboarding,
        timeZone,
        planId,
          createdAt: new Date().toISOString(),

      };

      if (!skipOnboarding) {
        body.defaultResolution = defaultResolution;
        body.defaultDestinations = defaultDestinations;
        body.defaultPrivacy = defaultPrivacy;
      }

      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      localStorage.setItem("sl_user", JSON.stringify(data.user));
      localStorage.setItem("sl_token", data.token);
      localStorage.setItem("sl_userId", data.user.id || data.user.uid); // 🔥 add this


      // After signup, go to your existing create-room page
      nav("/join");
    } catch (err) {
      console.error(err);
      setLoading(false);
      setError("Something went wrong. Try again.");
    }
  };

  const toggleDestination = (key) => {
    setDefaultDestinations((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6 text-center">
      <h2 className="text-3xl font-bold mb-6">Create Your StreamLine Account</h2>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col w-full max-w-sm space-y-6 text-left"
      >
        {/* STEP 1 – Basic profile */}
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Step 1 – Basic StreamLine Profile
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Display name</label>
              <input
                type="text"
                placeholder="What should we call you?"
                className="w-full p-3 rounded-lg bg-gray-800 text-white outline-none"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full p-3 rounded-lg bg-gray-800 text-white outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full p-3 rounded-lg bg-gray-800 text-white outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

      {/* Plan selection */}
      <div className="mt-4">
        <p className="block text-sm mb-2 font-semibold">Choose your plan</p>

        <div className="space-y-2">
          {/* Free */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="plan"
              value="free"
              checked={planId === "free"}
              onChange={(e) => setPlanId(e.target.value)}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Free</div>
              <div className="text-xs text-gray-400">
                Get started with StreamLine at no cost.
              </div>
            </div>
          </label>

          {/* Starter */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="plan"
              value="starter"
              checked={planId === "starter"}
              onChange={(e) => setPlanId(e.target.value)}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Starter</div>
              <div className="text-xs text-gray-400">
                For new creators streaming a few times a month.
              </div>
            </div>
          </label>

          {/* Pro */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="plan"
              value="pro"
              checked={planId === "pro"}
              onChange={(e) => setPlanId(e.target.value)}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Pro</div>
              <div className="text-xs text-gray-400">
                More hours and guests for growing shows.
              </div>
            </div>
          </label>

          {/* Enterprise */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="plan"
              value="enterprise"
              checked={planId === "enterprise"}
              onChange={(e) => setPlanId(e.target.value)}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Enterprise</div>
              <div className="text-xs text-gray-400">
                Teams, networks, and high-usage creators.
              </div>
            </div>
          </label>

          
        </div>
      </div>


            <div>
              <label className="block text-sm mb-1">Time zone (optional)</label>
              <input
                type="text"
                placeholder="America/Detroit"
                className="w-full p-3 rounded-lg bg-gray-800 text-white outline-none"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Skip streaming setup toggle */}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={skipOnboarding}
            onChange={(e) => setSkipOnboarding(e.target.checked)}
          />
          <span>
            Skip streaming setup for now.
            <br />
            <span className="text-xs text-gray-400">
              If you skip, you can still go live – you&apos;ll just set up
              YouTube/Facebook and stream keys later from inside your rooms.
            </span>
          </span>
        </label>

        {/* Only show streaming setup if not skipping */}
        {!skipOnboarding && (
          <>
            {/* STEP 2 – Connect destinations (visual only for now) */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-2">
                Step 2 – Connect Destinations
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                In a future update, you&apos;ll be able to fully connect your
                YouTube and Facebook accounts here. For now, we&apos;ll just
                remember your streaming preferences.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="w-full py-2 rounded-lg bg-gray-800 text-sm text-gray-300 border border-gray-600 cursor-default"
                >
                  Connect YouTube (coming soon)
                </button>
                <button
                  type="button"
                  className="w-full py-2 rounded-lg bg-gray-800 text-sm text-gray-300 border border-gray-600 cursor-default"
                >
                  Connect Facebook (coming soon)
                </button>
              </div>
            </div>

            {/* STEP 3 – Streaming defaults */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-2">
                Step 3 – Streaming Defaults
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1">
                    Default resolution
                  </label>
                  <select
                    className="w-full p-3 rounded-lg bg-gray-800 text-white outline-none"
                    value={defaultResolution}
                    onChange={(e) => setDefaultResolution(e.target.value)}
                  >
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-1">
                    Default destinations
                  </label>
                  <div className="flex flex-col gap-1 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={defaultDestinations.youtube}
                        onChange={() => toggleDestination("youtube")}
                      />
                      <span>Use YouTube by default when I go live</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={defaultDestinations.facebook}
                        onChange={() => toggleDestination("facebook")}
                      />
                      <span>Use Facebook by default when I go live</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1">
                    Default YouTube privacy (optional)
                  </label>
                  <select
                    className="w-full p-3 rounded-lg bg-gray-800 text-white outline-none"
                    value={defaultPrivacy}
                    onChange={(e) => setDefaultPrivacy(e.target.value)}
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 bg-white text-black py-3 rounded-xl font-semibold hover:bg-gray-300 transition w-full disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </div>
  );
};
