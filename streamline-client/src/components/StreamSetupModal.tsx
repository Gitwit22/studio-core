import { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStart: (keys: {
    youtubeKey?: string;
    facebookKey?: string;
    twitchKey?: string;
  }) => Promise<void>;
  onStop: () => Promise<void>;
  status: string;
}

export default function StreamSetupModal({
  isOpen,
  onClose,
  onStart,
  onStop,
  status,
}: Props) {
  const [useYouTube, setUseYouTube] = useState(false);
  const [useFacebook, setUseFacebook] = useState(false);
  const [useTwitch, setUseTwitch] = useState(false);

  const [youtubeKey, setYoutubeKey] = useState("");
  const [facebookKey, setFacebookKey] = useState("");
  const [twitchKey, setTwitchKey] = useState("");

  if (!isOpen) return null;

  const isLive = status === "live";
  const isBusy = status === "starting" || status === "stopping";

  const handleStart = async () => {
    const yt = useYouTube ? youtubeKey.trim() : "";
    const fb = useFacebook ? facebookKey.trim() : "";
    const tw = useTwitch ? twitchKey.trim() : "";

    console.log("🎬 StreamSetupModal - handleStart called");
    console.log("   YouTube enabled:", useYouTube, "key:", yt ? `${yt.slice(0, 4)}...` : "(empty)");
    console.log("   Facebook enabled:", useFacebook, "key:", fb ? `${fb.slice(0, 4)}...` : "(empty)");
    console.log("   Twitch enabled:", useTwitch, "key:", tw ? `${tw.slice(0, 4)}...` : "(empty)");

    if (!yt && !fb && !tw) {
      alert("Enter at least one stream key (YouTube, Facebook, or Twitch).");
      return;
    }

    const keys = {
      youtubeKey: yt || undefined,
      facebookKey: fb || undefined,
      twitchKey: tw || undefined,
    };

    console.log("   Calling onStart with keys:", {
      youtubeKey: keys.youtubeKey ? "✓ provided" : "✗ empty",
      facebookKey: keys.facebookKey ? "✓ provided" : "✗ empty",
      twitchKey: keys.twitchKey ? "✓ provided" : "✗ empty",
    });

    await onStart(keys);
  };

  const handleStop = async () => {
    await onStop();
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      zIndex: 50,
      pointerEvents: 'auto'
    }}>
      {/* Floating Menu Card */}
      <div style={{
        background: 'rgba(20, 20, 20, 0.98)',
        borderRadius: '0.75rem',
        border: '1px solid rgba(220, 38, 38, 0.5)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px rgba(220, 38, 38, 0.2)',
        width: '340px',
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
              SETUP STREAM
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isBusy}
            style={{
              background: 'rgba(220, 38, 38, 0.2)',
              border: '1px solid rgba(220, 38, 38, 0.5)',
              borderRadius: '0.375rem',
              color: '#ef4444',
              padding: '0.4rem 0.6rem',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              transition: 'all 0.3s ease',
              fontWeight: 'bold',
              opacity: isBusy ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isBusy) {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'rgba(220, 38, 38, 0.4)';
                target.style.borderColor = 'rgba(220, 38, 38, 0.8)';
                target.style.boxShadow = '0 0 15px rgba(220, 38, 38, 0.3)';
              }
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
          <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
            Paste your <strong>stream keys</strong> for any platform. No logins saved.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* YouTube */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={useYouTube}
                onChange={() => setUseYouTube(v => !v)}
                style={{ marginTop: '0.25rem', cursor: 'pointer', accentColor: '#ef4444' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>YouTube Live</div>
                <input
                  type="text"
                  value={youtubeKey}
                  onChange={(e) => setYoutubeKey(e.target.value)}
                  placeholder="Stream Key"
                  disabled={!useYouTube || isBusy || isLive}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.5rem',
                    background: 'rgba(31, 41, 55, 0.7)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '0.25rem',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    opacity: (!useYouTube || isBusy || isLive) ? 0.5 : 1,
                    cursor: (!useYouTube || isBusy || isLive) ? 'not-allowed' : 'text'
                  }}
                  onFocus={(e) => {
                    if (!(!useYouTube || isBusy || isLive)) {
                      e.target.style.borderColor = '#ef4444';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                  }}
                />
              </div>
            </label>

            {/* Facebook */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={useFacebook}
                onChange={() => setUseFacebook(v => !v)}
                style={{ marginTop: '0.25rem', cursor: 'pointer', accentColor: '#ef4444' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Facebook Live</div>
                <input
                  type="text"
                  value={facebookKey}
                  onChange={(e) => setFacebookKey(e.target.value)}
                  placeholder="Stream Key"
                  disabled={!useFacebook || isBusy || isLive}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.5rem',
                    background: 'rgba(31, 41, 55, 0.7)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '0.25rem',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    opacity: (!useFacebook || isBusy || isLive) ? 0.5 : 1,
                    cursor: (!useFacebook || isBusy || isLive) ? 'not-allowed' : 'text'
                  }}
                  onFocus={(e) => {
                    if (!(!useFacebook || isBusy || isLive)) {
                      e.target.style.borderColor = '#3b82f6';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                  }}
                />
                <p style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>
                  Get your key from Facebook Live Producer → Use Stream Key
                </p>
              </div>
            </label>

            {/* Twitch */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={useTwitch}
                onChange={() => setUseTwitch(v => !v)}
                style={{ marginTop: '0.25rem', cursor: 'pointer', accentColor: '#ef4444' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Twitch</div>
                <input
                  type="text"
                  value={twitchKey}
                  onChange={(e) => setTwitchKey(e.target.value)}
                  placeholder="Stream Key"
                  disabled={!useTwitch || isBusy || isLive}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.5rem',
                    background: 'rgba(31, 41, 55, 0.7)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '0.25rem',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    opacity: (!useTwitch || isBusy || isLive) ? 0.5 : 1,
                    cursor: (!useTwitch || isBusy || isLive) ? 'not-allowed' : 'text'
                  }}
                  onFocus={(e) => {
                    if (!(!useTwitch || isBusy || isLive)) {
                      e.target.style.borderColor = '#ef4444';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                  }}
                />
              </div>
            </label>
          </div>

          {/* Status & Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(220, 38, 38, 0.2)' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
              Status: <strong style={{ color: isLive ? '#ef4444' : '#9ca3af' }}>{(status || "").toUpperCase()}</strong>
            </div>

            {!isLive ? (
              <button
                onClick={handleStart}
                disabled={isBusy}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '0.375rem',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  cursor: isBusy ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: isBusy ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isBusy) {
                    const target = e.target as HTMLButtonElement;
                    target.style.background = 'linear-gradient(135deg, #16a34a, #15803d)';
                    target.style.boxShadow = '0 0 12px rgba(34, 197, 94, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
                  target.style.boxShadow = 'none';
                }}
              >
                {(status as string) === "starting" ? "Starting…" : "Go Live"}
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={isBusy}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '0.375rem',
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  cursor: isBusy ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: isBusy ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isBusy) {
                    const target = e.target as HTMLButtonElement;
                    target.style.background = 'linear-gradient(135deg, #b91c1c, #991b1b)';
                    target.style.boxShadow = '0 0 12px rgba(220, 38, 38, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)';
                  target.style.boxShadow = 'none';
                }}
              >
                {(status as string) === "stopping" ? "Stopping…" : "Stop Stream"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
