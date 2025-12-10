import React, { useState, useEffect } from 'react';
import { Download, Edit, X, Play, Pause, Scissors, Volume2, Sparkles, Upload, CheckCircle, Youtube, Facebook, Twitter } from 'lucide-react';

const PostStreamFlow: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('post-stream');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playheadPosition, setPlayheadPosition] = useState<number>(25);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const streamData = {
    title: 'Weekly Gaming Stream - Dec 6',
    duration: '2:34:15',
    viewers: 247,
    thumbnail: '🎮'
  };

  const clips = [
    { id: 1, start: 0, duration: 35, color: 'from-purple-500 to-pink-500' },
    { id: 2, start: 35, duration: 40, color: 'from-blue-500 to-cyan-500' },
    { id: 3, start: 75, duration: 45, color: 'from-emerald-500 to-teal-500' },
  ];

  // Simulate render progress
  useEffect(() => {
    if (currentView === 'render') {
      const interval = setInterval(() => {
        setRenderProgress((prev: number) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              const uploadInterval = setInterval(() => {
                setUploadProgress((p: number) => {
                  if (p >= 100) {
                    clearInterval(uploadInterval);
                    return 100;
                  }
                  return p + 2;
                });
              }, 100);
            }, 1000);
            return 100;
          }
          return prev + 1;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [currentView]);

  const renderPostStreamPage = (): JSX.Element => (
    <div style={{
      minHeight: '100vh',
      background: '#000000',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated Background Orbs */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '10%',
        width: '300px',
        height: '300px',
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
        width: '250px',
        height: '250px',
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
      
      <div style={{ maxWidth: '1024px', width: '100%', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #dc2626, #ef4444)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 0 30px rgba(220, 38, 38, 0.3)'
          }}>
            <CheckCircle style={{ width: '40px', height: '40px' }} />
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>Stream Complete!</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.125rem' }}>Great session - 247 viewers watched for 2h 34m</p>
        </div>

        <div style={{
          background: 'rgba(39, 39, 42, 0.5)',
          border: '1px solid rgba(63, 63, 70, 0.8)',
          borderRadius: '1rem',
          overflow: 'hidden',
          marginBottom: '2rem',
          backdropFilter: 'blur(20px)'
        }}>
          <div style={{
            aspectRatio: '16/9',
            background: 'linear-gradient(135deg, rgba(39, 39, 42, 0.8), rgba(24, 24, 27, 0.9))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '5rem',
            position: 'relative'
          }}>
            {streamData.thumbnail}
            <div style={{
              position: 'absolute',
              inset: '0',
              background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '1rem',
              left: '1rem',
              right: '1rem',
              display: 'flex',
              alignItems: 'end',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{streamData.title}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: 'rgba(212, 212, 216, 0.8)' }}>
                  <span>Duration: {streamData.duration}</span>
                  <span>•</span>
                  <span>{streamData.viewers} viewers</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={() => setCurrentView('editor')}
            style={{
              position: 'relative',
              background: 'rgba(220, 38, 38, 0.1)',
              border: '2px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '1rem',
              padding: '2rem',
              textAlign: 'left',
              overflow: 'hidden',
              backdropFilter: 'blur(20px)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.8)';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(220, 38, 38, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              background: 'rgba(220, 38, 38, 0.2)',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Edit style={{ width: '28px', height: '28px', color: '#dc2626' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Edit Recording</h3>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>Cut, trim, and polish your stream</p>
          </button>

          <button style={{
            position: 'relative',
            background: 'rgba(39, 39, 42, 0.5)',
            border: '2px solid rgba(63, 63, 70, 0.8)',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'left',
            overflow: 'hidden',
            backdropFilter: 'blur(20px)',
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.borderColor = 'rgba(156, 163, 175, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = 'rgba(63, 63, 70, 0.8)';
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'rgba(63, 63, 70, 0.8)',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Download style={{ width: '28px', height: '28px', color: 'rgba(156, 163, 175, 0.8)' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Download Now</h3>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>Get the raw recording (2.1 GB)</p>
          </button>

          <button style={{
            position: 'relative',
            background: 'rgba(39, 39, 42, 0.5)',
            border: '2px solid rgba(63, 63, 70, 0.8)',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'left',
            overflow: 'hidden',
            backdropFilter: 'blur(20px)',
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.borderColor = 'rgba(156, 163, 175, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = 'rgba(63, 63, 70, 0.8)';
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'rgba(63, 63, 70, 0.8)',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <X style={{ width: '28px', height: '28px', color: 'rgba(156, 163, 175, 0.8)' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Exit</h3>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>Leave without saving</p>
          </button>
        </div>

        <div style={{
          background: 'rgba(39, 39, 42, 0.5)',
          border: '1px solid rgba(63, 63, 70, 0.8)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          backdropFilter: 'blur(20px)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>247</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(161, 161, 170, 0.8)', marginTop: '0.25rem' }}>Peak Viewers</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>1,842</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(161, 161, 170, 0.8)', marginTop: '0.25rem' }}>Total Views</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>2h 34m</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(161, 161, 170, 0.8)', marginTop: '0.25rem' }}>Stream Length</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>156</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(161, 161, 170, 0.8)', marginTop: '0.25rem' }}>Chat Messages</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEditorPage = (): JSX.Element => (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#ffffff', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: 'rgba(39, 39, 42, 0.8)',
        borderBottom: '1px solid rgba(63, 63, 70, 0.8)',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => setCurrentView('post-stream')}
            style={{
              color: 'rgba(161, 161, 170, 0.8)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(161, 161, 170, 0.8)'}
          >
            ← Back
          </button>
          <div>
            <div style={{ fontWeight: '600' }}>{streamData.title}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(161, 161, 170, 0.8)' }}>Editing • Auto-saved 1 min ago</div>
          </div>
        </div>
        <button 
          onClick={() => setCurrentView('render')}
          style={{
            padding: '0.625rem 1.5rem',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #dc2626, #ef4444)',
            border: 'none',
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #b91c1c, #dc2626)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(220, 38, 38, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626, #ef4444)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Continue to Export →
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{
          width: '256px',
          background: 'rgba(39, 39, 42, 0.8)',
          borderRight: '1px solid rgba(63, 63, 70, 0.8)',
          padding: '1rem',
          backdropFilter: 'blur(20px)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'rgba(161, 161, 170, 0.8)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Basic Tools</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'}>
                  <Scissors style={{ width: '16px', height: '16px', color: '#dc2626' }} />
                  <span>Split Clip</span>
                  <kbd style={{ marginLeft: 'auto', fontSize: '0.75rem', background: 'rgba(39, 39, 42, 0.8)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>S</kbd>
                </button>
                <button style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(63, 63, 70, 0.3)',
                  border: 'none',
                  fontSize: '0.875rem',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(63, 63, 70, 0.5)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(63, 63, 70, 0.3)'}>
                  <Volume2 style={{ width: '16px', height: '16px', color: 'rgba(156, 163, 175, 0.8)' }} />
                  <span>Adjust Audio</span>
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'rgba(161, 161, 170, 0.8)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles style={{ width: '12px', height: '12px' }} />
                AI Tools
                <span style={{ marginLeft: 'auto', color: '#dc2626', fontSize: '10px', background: 'rgba(220, 38, 38, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '9999px' }}>PRO</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(220, 38, 38, 0.15)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}>
                  <Sparkles style={{ width: '16px', height: '16px', color: '#dc2626' }} />
                  <span>Remove Silence</span>
                </button>
                <button style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(63, 63, 70, 0.3)',
                  border: 'none',
                  fontSize: '0.875rem',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(63, 63, 70, 0.5)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(63, 63, 70, 0.3)'}>
                  <span>Add Captions</span>
                </button>
                <button style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(63, 63, 70, 0.3)',
                  border: 'none',
                  fontSize: '0.875rem',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(63, 63, 70, 0.5)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(63, 63, 70, 0.3)'}>
                  <span>Find Best Moments</span>
                </button>
              </div>
            </div>

            <div style={{ paddingTop: '1rem', borderTop: '1px solid rgba(63, 63, 70, 0.8)' }}>
              <button style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                background: 'rgba(63, 63, 70, 0.8)',
                border: 'none',
                fontSize: '0.875rem',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(82, 82, 91, 0.8)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(63, 63, 70, 0.8)'}>
                Undo
                <kbd style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: 'rgba(82, 82, 91, 0.8)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>⌘Z</kbd>
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            background: '#000000',
            borderBottom: '1px solid rgba(63, 63, 70, 0.8)',
            padding: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '50%'
          }}>
            <div style={{
              position: 'relative',
              width: '100%',
              maxWidth: '1024px',
              aspectRatio: '16/9',
              background: 'rgba(39, 39, 42, 0.8)',
              borderRadius: '1rem',
              overflow: 'hidden',
              border: '1px solid rgba(63, 63, 70, 0.8)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(20px)'
            }}>
              <div style={{
                position: 'absolute',
                inset: '0',
                background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(239, 68, 68, 0.05))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '4rem'
              }}>
                {streamData.thumbnail}
              </div>
              
              {/* Play button overlay */}
              <div style={{ position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(15px)',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  {isPlaying ? 
                    <Pause style={{ width: '40px', height: '40px' }} /> : 
                    <Play style={{ width: '40px', height: '40px', marginLeft: '8px' }} />
                  }
                </button>
              </div>

              <div style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                right: '0',
                background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 60%, transparent 100%)',
                padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    {isPlaying ? <Pause style={{ width: '24px', height: '24px' }} /> : <Play style={{ width: '24px', height: '24px' }} />}
                  </button>
                  <div style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>00:42:15</div>
                  <div style={{
                    flex: '1',
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}>
                    <div style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #dc2626, #ef4444)',
                      width: '27%'
                    }} />
                  </div>
                  <div style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: 'rgba(161, 161, 170, 0.8)' }}>2:34:15</div>
                  <button style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'color 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}>
                    <Volume2 style={{ width: '24px', height: '24px' }} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            flex: '1',
            background: 'rgba(9, 9, 11, 0.9)',
            padding: '1.5rem',
            overflow: 'auto',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>Timeline</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'rgba(161, 161, 170, 0.8)' }}>2:34:15 total</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(63, 63, 70, 0.8)',
                    border: 'none',
                    fontSize: '0.75rem',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'background 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(82, 82, 91, 0.8)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(63, 63, 70, 0.8)'}>−</button>
                  <span style={{ fontSize: '0.75rem', color: 'rgba(161, 161, 170, 0.8)', width: '48px', textAlign: 'center' }}>100%</span>
                  <button style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(63, 63, 70, 0.8)',
                    border: 'none',
                    fontSize: '0.75rem',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'background 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(82, 82, 91, 0.8)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(63, 63, 70, 0.8)'}>+</button>
                </div>
              </div>
            </div>

            <div style={{
              position: 'relative',
              height: '32px',
              marginBottom: '0.75rem',
              borderBottom: '1px solid rgba(63, 63, 70, 0.8)'
            }}>
              <div style={{
                position: 'absolute',
                inset: '0',
                display: 'flex',
                fontSize: '10px',
                color: 'rgba(161, 161, 170, 0.8)',
                fontFamily: 'monospace'
              }}>
                {['0:00', '0:30', '1:00', '1:30', '2:00', '2:30'].map((time) => (
                  <div key={time} style={{
                    flex: '1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{
                      height: '12px',
                      width: '1px',
                      background: 'rgba(82, 82, 91, 0.8)'
                    }} />
                    <div style={{ marginTop: '0.25rem' }}>{time}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(161, 161, 170, 0.8)',
                marginBottom: '0.5rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  background: 'rgba(220, 38, 38, 0.2)',
                  borderRadius: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: '#dc2626',
                    borderRadius: '0.25rem'
                  }} />
                </div>
                Video Track
              </div>
              <div style={{
                position: 'relative',
                height: '96px',
                background: 'rgba(39, 39, 42, 0.8)',
                borderRadius: '0.75rem',
                border: '1px solid rgba(63, 63, 70, 0.8)',
                overflow: 'hidden',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(20px)'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: '0',
                  display: 'flex',
                  gap: '4px',
                  padding: '0.5rem'
                }}>
                  {clips.map((clip, index) => (
                    <div
                      key={clip.id}
                      style={{
                        position: 'relative',
                        background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                        borderRadius: '0.5rem',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        width: `${(clip.duration / 120) * 100}%`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        inset: '0',
                        padding: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{
                          fontSize: '10px',
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontWeight: '600'
                        }}>Segment {index + 1}</div>
                        <div style={{
                          fontSize: '9px',
                          color: 'rgba(255, 255, 255, 0.7)'
                        }}>{clip.duration}s</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div 
                  className="absolute top-0 bottom-0 w-1 bg-red-500 z-10 cursor-ew-resize shadow-lg"
                  style={{ left: `${(playheadPosition / 120) * 100}%` }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full">
                    <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-transparent border-t-red-500"></div>
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full -mt-6 bg-red-500 text-white text-[10px] font-mono px-2 py-1 rounded whitespace-nowrap">
                    00:42:15
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="text-xs text-zinc-500 mb-2 font-medium flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center">
                  <Volume2 className="w-3 h-3 text-blue-400" />
                </div>
                Audio Track
              </div>
              <div className="h-20 bg-zinc-900 rounded-xl border border-zinc-800 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center gap-[2px] px-2">
                  {Array.from({ length: 80 }).map((_, i) => (
                    <div 
                      key={i}
                      className="flex-1 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-full opacity-60"
                      style={{ height: `${Math.random() * 60 + 20}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-72 bg-zinc-900 border-l border-zinc-800 p-4 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <div className="text-sm font-semibold mb-4">Clip Properties</div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">Start Time</label>
                  <input 
                    type="text" 
                    defaultValue="00:00:00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">Duration</label>
                  <input 
                    type="text" 
                    defaultValue="00:35:00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">Volume</label>
                  <input type="range" className="w-full" defaultValue="80" />
                  <div className="flex justify-between text-xs text-zinc-600 mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <div className="text-sm font-semibold mb-3">Project Info</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Duration</span>
                  <span className="font-mono">2:34:15</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Segments</span>
                  <span>3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Size</span>
                  <span>~2.1 GB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUploadPage = (): JSX.Element => {
    const isRendering = renderProgress < 100;
    const isUploading = renderProgress === 100 && uploadProgress < 100;
    const isComplete = renderProgress === 100 && uploadProgress === 100;

    return (
      <div style={{
        minHeight: '100vh',
        background: '#000000',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated Background Orbs */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '15%',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #dc2626, #ef4444)',
          opacity: 0.08,
          filter: 'blur(50px)',
          animation: 'float 8s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '30%',
          right: '20%',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          opacity: 0.1,
          filter: 'blur(60px)',
          animation: 'float 10s ease-in-out infinite reverse'
        }} />
        
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-30px) rotate(180deg); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>

        <div style={{ maxWidth: '768px', width: '100%', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            {isRendering && (
              <>
                <div style={{
                  width: '80px',
                  height: '80px',
                  border: '4px solid #dc2626',
                  borderTop: '4px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1.5rem'
                }} />
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Rendering Your Video</h1>
                <p style={{ color: 'rgba(161, 161, 170, 0.8)' }}>This usually takes 2-3 minutes...</p>
              </>
            )}
            {isUploading && (
              <>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  animation: 'pulse 2s ease-in-out infinite'
                }}>
                  <Upload style={{ width: '40px', height: '40px' }} />
                </div>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Uploading to Platforms</h1>
                <p style={{ color: 'rgba(161, 161, 170, 0.8)' }}>Publishing to your connected accounts...</p>
              </>
            )}
            {isComplete && (
              <>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  boxShadow: '0 0 30px rgba(220, 38, 38, 0.5)'
                }}>
                  <CheckCircle style={{ width: '40px', height: '40px' }} />
                </div>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Upload Complete! 🎉</h1>
                <p style={{ color: 'rgba(161, 161, 170, 0.8)' }}>Your video is now live on all platforms</p>
              </>
            )}
          </div>

          {isRendering && (
            <div style={{
              background: 'rgba(39, 39, 42, 0.5)',
              border: '1px solid rgba(63, 63, 70, 0.8)',
              borderRadius: '1rem',
              padding: '2rem',
              marginBottom: '1.5rem',
              backdropFilter: 'blur(20px)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem'
              }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Rendering Video</span>
                <span style={{
                  fontSize: '0.875rem',
                  color: '#dc2626',
                  fontFamily: 'monospace'
                }}>{renderProgress}%</span>
              </div>
              <div style={{
                height: '12px',
                background: 'rgba(63, 63, 70, 0.8)',
                borderRadius: '9999px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #dc2626, #ef4444)',
                  transition: 'width 0.3s ease',
                  width: `${renderProgress}%`
                }} />
              </div>
              <div style={{
                marginTop: '1rem',
                fontSize: '0.75rem',
                color: 'rgba(161, 161, 170, 0.8)'
              }}>
                Processing with FFmpeg • 1080p @ 30fps
              </div>
            </div>
          )}

          {(isUploading || isComplete) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{
                background: 'rgba(39, 39, 42, 0.5)',
                border: '1px solid rgba(63, 63, 70, 0.8)',
                borderRadius: '1rem',
                padding: '1.5rem',
                backdropFilter: 'blur(20px)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    borderRadius: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Youtube style={{ width: '24px', height: '24px', color: '#ef4444' }} />
                  </div>
                  <div style={{ flex: '1' }}>
                    <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>YouTube</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(161, 161, 170, 0.8)' }}>YourChannel</div>
                  </div>
                  {isComplete && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem',
                      color: '#dc2626'
                    }}>
                      <CheckCircle style={{ width: '16px', height: '16px' }} />
                      Live
                    </div>
                  )}
                </div>
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-500 to-red-400"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {isComplete && (
                  <button className="text-sm text-blue-400 hover:text-blue-300 underline">
                    View on YouTube →
                  </button>
                )}
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Facebook className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold mb-1">Facebook</div>
                    <div className="text-xs text-zinc-500">Your Page</div>
                  </div>
                  {isComplete && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      Live
                    </div>
                  )}
                </div>
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Uploading...</span>
                      <span>{Math.max(0, uploadProgress - 10)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
                        style={{ width: `${Math.max(0, uploadProgress - 10)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {isComplete && (
                  <button className="text-sm text-blue-400 hover:text-blue-300 underline">
                    View on Facebook →
                  </button>
                )}
              </div>

              <div style={{
                background: 'rgba(39, 39, 42, 0.3)',
                border: '1px solid rgba(63, 63, 70, 0.5)',
                borderRadius: '1rem',
                padding: '1.5rem',
                opacity: '0.5',
                backdropFilter: 'blur(20px)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: 'rgba(6, 182, 212, 0.2)',
                    borderRadius: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Twitter style={{ width: '24px', height: '24px', color: '#06b6d4' }} />
                  </div>
                  <div style={{ flex: '1' }}>
                    <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Twitter / X</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(161, 161, 170, 0.8)' }}>Not connected</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isComplete && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setCurrentView('post-stream')}
                style={{
                  flex: '1',
                  padding: '1rem 1.5rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(39, 39, 42, 0.5)',
                  border: '1px solid rgba(63, 63, 70, 0.8)',
                  color: '#ffffff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(20px)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(156, 163, 175, 0.6)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(63, 63, 70, 0.8)'}
              >
                Back to Home
              </button>
              <button style={{
                flex: '1',
                padding: '1rem 1.5rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                border: 'none',
                color: '#ffffff',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #b91c1c, #dc2626)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(220, 38, 38, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626, #ef4444)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                Share Links
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {currentView === 'post-stream' && renderPostStreamPage()}
      {currentView === 'editor' && renderEditorPage()}
      {currentView === 'render' && renderUploadPage()}
    </div>
  );
};

export default PostStreamFlow;
