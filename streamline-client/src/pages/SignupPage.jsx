import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Use relative paths - Vite proxy forwards /api/* to http://localhost:5137
const API_BASE = import.meta.env.VITE_API_BASE || "";

// Email validation function
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.com$/;
  return re.test(email);
}

export const SignupPage = () => {
  const nav = useNavigate();
  const [planId, setPlanId] = useState("free");
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

  // Auto-fill timezone using browser
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

    // Validate email format
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    try {
      const body = {
        displayName,
        email,
        password,
        timeZone,
        planId,
        skipOnboarding,
        defaultResolution: skipOnboarding ? undefined : defaultResolution,
        defaultDestinations: skipOnboarding ? undefined : defaultDestinations,
        defaultPrivacy: skipOnboarding ? undefined : defaultPrivacy,
      };

      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoading(false);
        setError(data.error || "Signup failed");
        return;
      }

      localStorage.setItem("sl_user", JSON.stringify(data.user));
      localStorage.setItem("sl_token", data.token);
      localStorage.setItem("sl_userId", data.user.id || data.user.uid);

      // After signup, go to create-room page
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000000',
      color: '#ffffff',
      padding: '1.5rem',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated Background Orbs */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '10%',
        width: '250px',
        height: '250px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #dc2626, #ef4444)',
        opacity: 0.1,
        filter: 'blur(40px)',
        animation: 'float 6s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '15%',
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        opacity: 0.08,
        filter: 'blur(30px)',
        animation: 'float 8s ease-in-out infinite reverse'
      }} />
      
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>

      <h2 style={{
        fontSize: '1.875rem',
        fontWeight: 'bold',
        marginBottom: '1.5rem',
        position: 'relative',
        zIndex: 1
      }}>Create Your StreamLine Account</h2>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '420px',
          gap: '1.5rem',
          textAlign: 'left',
          background: 'rgba(39, 39, 42, 0.5)',
          padding: '2rem',
          borderRadius: '1rem',
          border: '1px solid rgba(63, 63, 70, 0.8)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* STEP 1 – Basic profile */}
        <div>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            marginBottom: '0.5rem',
            color: '#dc2626'
          }}>
            Step 1 – Basic StreamLine Profile
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Display name</label>
              <input
                type="text"
                placeholder="What should we call you?"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(31, 41, 55, 0.8)',
                  color: '#ffffff',
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onFocus={(e) => e.target.style.borderColor = '#dc2626'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)'}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(31, 41, 55, 0.8)',
                  color: '#ffffff',
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onFocus={(e) => e.target.style.borderColor = '#dc2626'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(31, 41, 55, 0.8)',
                  color: '#ffffff',
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onFocus={(e) => e.target.style.borderColor = '#dc2626'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Timezone</label>
              <input
                type="text"
                placeholder="Your timezone"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(31, 41, 55, 0.8)',
                  color: '#ffffff',
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onFocus={(e) => e.target.style.borderColor = '#dc2626'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)'}
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Plan selection */}
        <div>
          <p style={{
            display: 'block',
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#dc2626'
          }}>Choose your plan</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Free */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              cursor: 'pointer',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(31, 41, 55, 0.5)',
              border: planId === 'free' ? '1px solid #dc2626' : '1px solid rgba(75, 85, 99, 0.3)',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}>
              <input
                type="radio"
                name="plan"
                value="free"
                checked={planId === "free"}
                onChange={(e) => setPlanId(e.target.value)}
                style={{ marginTop: '0.25rem', accentColor: '#dc2626' }}
              />
              <div>
                <div style={{ fontWeight: '500' }}>Free</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(156, 163, 175, 0.8)' }}>
                  Get started with StreamLine at no cost.
                </div>
              </div>
            </label>

            {/* Starter */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              cursor: 'pointer',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(31, 41, 55, 0.5)',
              border: planId === 'starter' ? '1px solid #dc2626' : '1px solid rgba(75, 85, 99, 0.3)',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}>
              <input
                type="radio"
                name="plan"
                value="starter"
                checked={planId === "starter"}
                onChange={(e) => setPlanId(e.target.value)}
                style={{ marginTop: '0.25rem', accentColor: '#dc2626' }}
              />
              <div>
                <div style={{ fontWeight: '500' }}>Starter</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(156, 163, 175, 0.8)' }}>
                  For new creators streaming a few times a month.
                </div>
              </div>
            </label>

            {/* Pro */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              cursor: 'pointer',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(31, 41, 55, 0.5)',
              border: planId === 'pro' ? '1px solid #dc2626' : '1px solid rgba(75, 85, 99, 0.3)',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}>
              <input
                type="radio"
                name="plan"
                value="pro"
                checked={planId === "pro"}
                onChange={(e) => setPlanId(e.target.value)}
                style={{ marginTop: '0.25rem', accentColor: '#dc2626' }}
              />
              <div>
                <div style={{ fontWeight: '500' }}>Pro</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(156, 163, 175, 0.8)' }}>
                  For serious streamers who go live weekly.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Skip onboarding checkbox */}
        <div>
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: '0.375rem',
            background: 'rgba(31, 41, 55, 0.3)'
          }}>
            <input
              type="checkbox"
              checked={skipOnboarding}
              onChange={(e) => setSkipOnboarding(e.target.checked)}
              style={{ marginTop: '0.125rem', accentColor: '#dc2626' }}
            />
            <span>Skip streaming setup for now (you can set this up later)</span>
          </label>
        </div>

        {/* STEP 2 – Streaming defaults */}
        {!skipOnboarding && (
          <>
            <div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: '#dc2626'
              }}>
                Step 2 – Streaming defaults (optional)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Default resolution
                  </label>
                  <select
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(31, 41, 55, 0.8)',
                      color: '#ffffff',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      outline: 'none',
                      backdropFilter: 'blur(10px)'
                    }}
                    value={defaultResolution}
                    onChange={(e) => setDefaultResolution(e.target.value)}
                  >
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Default destinations
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      background: 'rgba(31, 41, 55, 0.3)',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={defaultDestinations.youtube}
                        onChange={() => toggleDestination("youtube")}
                        style={{ accentColor: '#dc2626' }}
                      />
                      <span>Use YouTube by default when I go live</span>
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      background: 'rgba(31, 41, 55, 0.3)',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={defaultDestinations.facebook}
                        onChange={() => toggleDestination("facebook")}
                        style={{ accentColor: '#dc2626' }}
                      />
                      <span>Use Facebook by default when I go live</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Default YouTube privacy (optional)
                  </label>
                  <select
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(31, 41, 55, 0.8)',
                      color: '#ffffff',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      outline: 'none',
                      backdropFilter: 'blur(10px)'
                    }}
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
          style={{
            padding: '0.75rem',
            borderRadius: '0.75rem',
            background: loading ? 'rgba(75, 85, 99, 0.5)' : 'linear-gradient(135deg, #dc2626, #ef4444)',
            color: '#ffffff',
            fontWeight: '600',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            width: '100%',
            transition: 'all 0.3s ease',
            opacity: loading ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.target.style.background = 'linear-gradient(135deg, #b91c1c, #dc2626)';
              e.target.style.boxShadow = '0 0 20px rgba(220, 38, 38, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.target.style.background = 'linear-gradient(135deg, #dc2626, #ef4444)';
              e.target.style.boxShadow = 'none';
            }
          }}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      {error && (
        <p style={{
          marginTop: '1rem',
          color: '#ef4444',
          fontSize: '0.875rem',
          background: 'rgba(239, 68, 68, 0.1)',
          padding: '0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          zIndex: 1
        }}>
          {error}
        </p>
      )}
    </div>
  );
};
