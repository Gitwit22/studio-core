import { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStart: (keys: { 
    youtubeKey?: string; 
    facebookKeys?: string[]; 
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
  const [useYouTube, setUseYouTube] = useState(true);
  const [useFacebook, setUseFacebook] = useState(false);
  const [useTwitch, setUseTwitch] = useState(false);
  const [youtubeKey, setYoutubeKey] = useState("");
  const [facebookKeys, setFacebookKeys] = useState<string[]>([""]);
  const [twitchKey, setTwitchKey] = useState("");

  const facebookPageNames = ["Main Page", "Page 2", "Page 3", "Page 4", "Page 5"];
  const filledFacebookKeys = facebookKeys.filter(key => key.trim());
  const canAddMoreFacebook = facebookKeys.length < 5;

  if (!isOpen) return null;

  const isLive = status === "live";
  const isBusy = status === "starting" || status === "stopping";

  const handleStart = async () => {
    const yt = useYouTube ? youtubeKey.trim() : "";
    const fb = useFacebook ? facebookKeys.filter(k => k.trim()) : [];
    const tw = useTwitch ? twitchKey.trim() : "";

    if (!yt && fb.length === 0 && !tw) {
      alert("Enter at least one stream key (YouTube, Facebook, or Twitch).");
      return;
    }

    await onStart({
      youtubeKey: yt || undefined,
      facebookKeys: fb.length > 0 ? fb : undefined,
      twitchKey: tw || undefined,
    });
  };

  const addFacebookKey = () => {
    if (facebookKeys.length < 5) {
      setFacebookKeys([...facebookKeys, ""]);
    }
  };

  const removeFacebookKey = (index: number) => {
    if (facebookKeys.length > 1) {
      setFacebookKeys(facebookKeys.filter((_, i) => i !== index));
    }
  };

  const updateFacebookKey = (index: number, value: string) => {
    const updated = [...facebookKeys];
    updated[index] = value;
    setFacebookKeys(updated);
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={useFacebook}
                  onChange={() => setUseFacebook(v => !v)}
                  style={{ cursor: 'pointer', accentColor: '#ef4444' }}
                />
                <div style={{ fontWeight: '600' }}>Facebook Live</div>
                {useFacebook && (
                  <button
                    onClick={addFacebookKey}
                    disabled={!canAddMoreFacebook || isBusy || isLive}
                    style={{
                      marginLeft: 'auto',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.7rem',
                      borderRadius: '0.25rem',
                      background: canAddMoreFacebook && !isBusy && !isLive ? '#3b82f6' : 'rgba(59, 130, 246, 0.3)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: '600',
                      cursor: canAddMoreFacebook && !isBusy && !isLive ? 'pointer' : 'not-allowed',
                      transition: 'all 0.3s ease',
                      opacity: canAddMoreFacebook && !isBusy && !isLive ? 1 : 0.6
                    }}
                    onMouseEnter={(e) => {
                      if (canAddMoreFacebook && !isBusy && !isLive) {
                        const target = e.target as HTMLButtonElement;
                        target.style.background = '#2563eb';
                        target.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const target = e.target as HTMLButtonElement;
                      target.style.background = '#3b82f6';
                      target.style.boxShadow = 'none';
                    }}
                  >
                    + Add Page
                  </button>
                )}
              </label>

              {useFacebook && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.5rem', paddingLeft: '0.5rem', borderLeft: '2px solid #3b82f6' }}>
                  {facebookKeys.map((key, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <div style={{ 
                        background: '#3b82f6', 
                        color: '#ffffff', 
                        padding: '0.25rem 0.4rem', 
                        borderRadius: '0.25rem',
                        fontWeight: '600',
                        minWidth: '1.5rem',
                        textAlign: 'center'
                      }}>
                        #{index + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>
                          {facebookPageNames[index]}
                        </div>
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => updateFacebookKey(index, e.target.value)}
                          placeholder="Stream Key"
                          disabled={isBusy || isLive}
                          style={{
                            width: '100%',
                            padding: '0.4rem 0.5rem',
                            background: 'rgba(31, 41, 55, 0.7)',
                            border: '1px solid rgba(75, 85, 99, 0.5)',
                            borderRadius: '0.25rem',
                            color: '#ffffff',
                            fontSize: '0.7rem',
                            fontFamily: 'monospace',
                            outline: 'none',
                            transition: 'all 0.3s ease',
                            opacity: (isBusy || isLive) ? 0.5 : 1,
                            cursor: (isBusy || isLive) ? 'not-allowed' : 'text'
                          }}
                          onFocus={(e) => {
                            if (!(isBusy || isLive)) {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.boxShadow = '0 0 8px rgba(59, 130, 246, 0.3)';
                            }
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'rgba(75, 85, 99, 0.5)';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                      {facebookKeys.length > 1 && (
                        <button
                          onClick={() => removeFacebookKey(index)}
                          disabled={isBusy || isLive}
                          style={{
                            padding: '0.35rem 0.45rem',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            borderRadius: '0.25rem',
                            color: '#ef4444',
                            cursor: (isBusy || isLive) ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            transition: 'all 0.3s ease',
                            opacity: (isBusy || isLive) ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: '0.25rem'
                          }}
                          onMouseEnter={(e) => {
                            if (!(isBusy || isLive)) {
                              const target = e.target as HTMLButtonElement;
                              target.style.background = 'rgba(239, 68, 68, 0.4)';
                              target.style.borderColor = 'rgba(239, 68, 68, 0.8)';
                              target.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.3)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            const target = e.target as HTMLButtonElement;
                            target.style.background = 'rgba(239, 68, 68, 0.2)';
                            target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                            target.style.boxShadow = 'none';
                          }}
                          title="Delete this Facebook page"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  ))}

                  {filledFacebookKeys.length > 0 && (
                    <div style={{ 
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      color: '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>🔵</span>
                      <span>Streaming to <strong>{filledFacebookKeys.length}</strong> Facebook page{filledFacebookKeys.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

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
