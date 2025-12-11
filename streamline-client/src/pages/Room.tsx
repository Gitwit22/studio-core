import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import StreamSetupModal from "../components/StreamSetupModal";
import RoleOverlay from "../components/RoleOverlay";

// Use relative paths - Vite proxy forwards /api/* to http://localhost:5137
const API_BASE = "";

type StreamStatus = "idle" | "starting" | "live" | "stopping";
type RecordingStatus = "idle" | "recording" | "stopping" | "stopped";

function ThankYouScreen({ showHomeButton = false, onHome }: { showHomeButton?: boolean; onHome?: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.close();
      } catch (e) {}
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000000",
        color: "#ffffff",
        flexDirection: "column",
        textAlign: "center",
        padding: "1.5rem",
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Animated Background Orbs */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '10%',
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #dc2626, #ef4444)',
        opacity: 0.1,
        filter: 'blur(30px)',
        animation: 'float 6s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '15%',
        right: '15%',
        width: '150px',
        height: '150px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        opacity: 0.08,
        filter: 'blur(25px)',
        animation: 'float 8s ease-in-out infinite reverse'
      }} />
      
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>

      <div style={{
        background: 'rgba(39, 39, 42, 0.5)',
        borderRadius: '1rem',
        padding: '2.5rem',
        border: '1px solid rgba(63, 63, 70, 0.8)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        zIndex: 1,
        maxWidth: '500px'
      }}>
        <h1 style={{ fontSize: "1.875rem", marginBottom: "1rem", fontWeight: '600' }}>
          Thank you for joining StreamLine
        </h1>
        <p style={{ maxWidth: 400, opacity: 0.9, fontSize: '1.125rem', lineHeight: 1.6, marginBottom: showHomeButton ? '1.5rem' : '0' }}>
          Your session has ended. You can now close this app or tab.
        </p>
        {showHomeButton && onHome && (
          <button
            onClick={onHome}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(to right, #dc2626, #ef4444)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'linear-gradient(to right, #ef4444, #f87171)';
              target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'linear-gradient(to right, #dc2626, #ef4444)';
              target.style.transform = 'translateY(0)';
            }}
          >
            🏠 Back to Home
          </button>
        )}
      </div>
    </div>
  );
}

function StreamEndedModal({ recordingId, onStartEditing, onExitRoom }: { recordingId: string; onStartEditing: () => void; onExitRoom: () => void }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1a1a 100%)',
        border: '2px solid rgba(220, 38, 38, 0.3)',
        borderRadius: '1rem',
        padding: '2rem',
        maxWidth: '500px',
        width: '90%',
        textAlign: 'center',
        color: '#ffffff',
      }}>
        {/* Success Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #16a34a, #22c55e)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          fontSize: '2rem',
        }}>
          ✓
        </div>

        <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1rem' }}>Stream Ended</h2>
        <p style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '2rem' }}>
          Your recording is ready. Choose what you'd like to do next.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={onStartEditing}
            style={{
              width: '100%',
              padding: '1rem',
              background: 'linear-gradient(to right, #dc2626, #ef4444)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'linear-gradient(to right, #991b1b, #dc2626)';
              target.style.transform = 'translateY(-2px)';
              target.style.boxShadow = '0 10px 25px rgba(220, 38, 38, 0.3)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'linear-gradient(to right, #dc2626, #ef4444)';
              target.style.transform = 'translateY(0)';
              target.style.boxShadow = 'none';
            }}
          >
            ✂️ Start Editing
          </button>

          <button
            onClick={onExitRoom}
            style={{
              width: '100%',
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'rgba(255, 255, 255, 0.15)';
              target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.background = 'rgba(255, 255, 255, 0.1)';
              target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              target.style.transform = 'translateY(0)';
            }}
          >
            🚪 Exit Room
          </button>
        </div>
      </div>
    </div>
  );
}

function getOrCreateUid() {
  let uid = localStorage.getItem("sl_userId");
  if (!uid) {
    uid = localStorage.getItem("sl_guestId") || null;
  }
  if (!uid) {
    const rand = Math.random().toString(36).slice(2, 10);
    uid = `guest_${rand}`;
    localStorage.setItem("sl_guestId", uid);
  }
  return uid;
}

export default function Room() {
  const nav = useNavigate();
  const { roomName: rn } = useParams<{ roomName: string }>();
  const roomName = rn ?? "";
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  
  useEffect(() => {
    const start = Date.now();
    setSessionStart(start);
    // Store room name and session start time for exit page
    localStorage.setItem("sl_roomName", roomName);
    localStorage.setItem("sl_sessionStart", start.toString());
  }, [roomName]);

  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem("sl_displayName") ?? ""
  );
  const [pendingName, setPendingName] = useState(displayName);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [showStreamSetup, setShowStreamSetup] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [showGoodbye, setShowGoodbye] = useState(false);
  // First person to join is the host (based on stored host ID for this room)
  const currentUserId = getOrCreateUid();
  const [isHost, setIsHost] = useState(() => {
    const storedHostId = localStorage.getItem(`sl_room_${roomName}_hostId`);
    if (!storedHostId) {
      // This is the first person - set them as host
      localStorage.setItem(`sl_room_${roomName}_hostId`, currentUserId);
      return true;
    }
    return storedHostId === currentUserId;
  });

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const recordingRef = useRef<string | null>(null);
  const [viewerCount] = useState(Math.floor(Math.random() * 200) + 10);
  const [elapsedTime, setElapsedTime] = useState(0);
  const streamStartTimeRef = useRef<number | null>(null);
  const [didStreamThisSession, setDidStreamThisSession] = useState(false);
  const [showExitOptions, setShowExitOptions] = useState(false);

  useEffect(() => {
    if (!roomName || !displayName) return;

    const fetchToken = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/roomToken`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName,
            identity: displayName,
            uid: getOrCreateUid(),
          }),
        });

        if (!res.ok) {
          console.error("roomToken HTTP error", res.status);
          return;
        }

        const data = await res.json();
        const tokenFromApi =
          data.token || data.accessToken || data.jwt || data.roomToken;
        const serverUrlFromApi =
          data.serverUrl || data.server_url || data.url || data.livekitUrl;

        if (tokenFromApi && serverUrlFromApi) {
          setToken(tokenFromApi);
          setServerUrl(serverUrlFromApi);
        }
      } catch (err) {
        console.error("fetchToken error:", err);
      }
    };

    fetchToken();
  }, [roomName, displayName]);

  // Timer effect - runs when stream goes live
  useEffect(() => {
    if (streamStatus === "live") {
      if (!streamStartTimeRef.current) {
        streamStartTimeRef.current = Date.now();
      }

      const interval = setInterval(() => {
        if (streamStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - streamStartTimeRef.current) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      // Reset when stream ends
      streamStartTimeRef.current = null;
      setElapsedTime(0);
    }
  }, [streamStatus]);

  const handleLeftRoom = () => {
    setShowGoodbye(true);
  };

  const handleHomeClick = () => {
    nav('/join');
  };

  const startRecording = async () => {
    try {
      console.log("🔴 Starting recording...");
      setRecordingStatus("recording");
      
      const userId = localStorage.getItem('sl_userId');
      const authToken = localStorage.getItem('sl_token') || localStorage.getItem('auth_token');
      
      console.log("💾 Starting recording session - userId:", userId);

      if (!userId) {
        console.warn("⚠️ Cannot start recording: userId is missing");
        setRecordingStatus("idle");
        return;
      }

      if (!authToken) {
        console.warn("⚠️ Cannot start recording: authToken is missing");
        setRecordingStatus("idle");
        return;
      }

      // Use the new /api/editing/recordings/start endpoint
      const response = await fetch(`/api/editing/recordings/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          roomName: roomName || 'default-room',
          title: `Stream - ${new Date().toLocaleString()}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ Failed to start recording:", response.status, errorData);
        setRecordingStatus("idle");
        return;
      }

      const data = await response.json();
      console.log("✅ Recording started with ID:", data.id);
      setRecordingId(data.id);
      recordingRef.current = data.id;
    } catch (error) {
      console.error("❌ Failed to start recording:", error);
      setRecordingStatus("idle");
    }
  };

  const stopRecording = async () => {
    try {
      console.log("⏹️ Stopping recording...");
      
      const recordId = recordingRef.current;
      console.log("Recording ID to stop:", recordId);

      if (recordId) {
        // Calculate actual stream duration
        const duration = streamStartTimeRef.current ? Math.floor((Date.now() - streamStartTimeRef.current) / 1000) : 0;
        const userId = localStorage.getItem('sl_userId');
        const authToken = localStorage.getItem('sl_token') || localStorage.getItem('auth_token');
        
        console.log("📊 Stopping recording with duration:", duration, "seconds");

        // Call the new /api/editing/recordings/stop endpoint
        if (userId && recordId !== 'unknown') {
          try {
            const stopResponse = await fetch(`/api/editing/recordings/stop`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              },
              body: JSON.stringify({
                recordingId: recordId,
                duration,
                viewerCount,
                peakViewers: viewerCount,
              }),
            });

            if (stopResponse.ok) {
              console.log("✅ Recording stopped via API");
            } else {
              console.warn("⚠️ Failed to stop recording:", stopResponse.status);
            }
          } catch (updateError) {
            console.warn("⚠️ Error stopping recording:", updateError);
          }
        }

        // Set stream ended status and store the recording ID - DON'T navigate yet
        setRecordingStatus("stopped");
        setRecordingId(recordId);
      } else {
        console.warn("⚠️ No recording ID available");
        setRecordingStatus("stopped");
        setRecordingId("unknown");
      }
    } catch (error) {
      console.error("❌ Failed to stop recording:", error);
      setRecordingStatus("stopped");
      setRecordingId("unknown");
    }
  };

  useEffect(() => {
    if (isHost && token && !recordingRef.current) {
      // Recording now starts when stream goes live, not on join
    }
  }, [isHost, token]);

  const handleEndStream = async () => {
    // For hosts: if stream is still live, show message and wait
    if (isHost && streamStatus === "live") {
      alert("⏹️ Stream is still live. Stop the stream first.");
      return;
    }

    // For hosts: if recording is still active, show message and wait
    if (isHost && recordingStatus === "recording") {
      alert("⏹️ Recording is still active. Stop the stream first.");
      return;
    }

    // For hosts: show exit options menu
    if (isHost && didStreamThisSession) {
      setShowExitOptions(true);
      return;
    }

    // For hosts who never streamed - just show goodbye
    if (isHost) {
      console.log('👋 User never streamed - showing goodbye');
      setShowGoodbye(true);
      return;
    }

    // For guests: just leave the room with goodbye screen
    handleLeftRoom();
  };

  const handleStayAndRecord = () => {
    // Reset recording state for next stream
    setRecordingId(null);
    setRecordingStatus("idle");
    recordingRef.current = null;
    setShowExitOptions(false);
    // User stays in room, ready to click "Go Live" again
    console.log('🎬 Ready to record another session');
  };

  const handleViewSummary = () => {
    const finalRecordingId = recordingId || recordingRef.current;
    setShowExitOptions(false);
    
    if (finalRecordingId && finalRecordingId !== 'unknown') {
      nav(`/stream-summary/${finalRecordingId}`);
    } else {
      // Fallback to room exit page
      nav(`/room-exit/${roomName}`);
    }
  };

  const handleLeaveRoom = () => {
    setShowExitOptions(false);
    handleLeftRoom();
  };

  const handleStartMultistream = async (keys: {
    youtubeKey?: string;
    facebookKey?: string;
    twitchKey?: string;
  }) => {
    if (!roomName) {
      alert("No room name");
      return;
    }

    try {
      setStreamStatus("starting");

      // Get userId from localStorage
      const userId = localStorage.getItem("sl_userId");
      if (!userId) {
        alert("User ID not found. Please log in again.");
        setStreamStatus("idle");
        return;
      }

      const res = await fetch(
        `${API_BASE}/api/rooms/${encodeURIComponent(roomName)}/start-multistream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            youtubeStreamKey: keys.youtubeKey,
            facebookStreamKey: keys.facebookKey,
            twitchStreamKey: keys.twitchKey,
            userId, // ← Add userId
            guestCount: viewerCount, // ← Add viewer count
          }),
        }
      );

      if (!res.ok) {
        alert("Failed to start multistream");
        setStreamStatus("idle");
        return;
      }

      const data = await res.json();
      setEgressId(data.egressId);
      setStreamStatus("live");
      setDidStreamThisSession(true);
      // Start recording when stream goes live
      await startRecording();
    } catch (err) {
      console.error("Error starting multistream", err);
      alert("Error starting multistream");
      setStreamStatus("idle");
    }
  };

  const handleStopMultistream = async () => {
    if (!egressId) {
      alert("No active stream");
      return;
    }

    if (!roomName) {
      alert("No room name");
      return;
    }

    try {
      setStreamStatus("stopping");

      // Stop recording when stopping the stream (this saves to database)
      if (recordingStatus === "recording") {
        await stopRecording();
        // Don't return - continue to stop the multistream
      }

      const res = await fetch(
        `${API_BASE}/api/rooms/${encodeURIComponent(roomName)}/stop-multistream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ egressId }),
        }
      );

      if (!res.ok) {
        alert("Failed to stop multistream");
        setStreamStatus("live");
        return;
      }

      setEgressId(null);
      setStreamStatus("idle");
    } catch (err) {
      console.error("Error stopping multistream", err);
      alert("Error stopping multistream");
      setStreamStatus("live");
    }
  };

  if (!displayName) {
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
          opacity: 0.1,
          filter: 'blur(30px)',
          animation: 'float 7s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '25%',
          right: '20%',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          opacity: 0.08,
          filter: 'blur(25px)',
          animation: 'float 9s ease-in-out infinite reverse'
        }} />
        
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(180deg); }
          }
        `}</style>

        <form
          style={{
            background: 'rgba(39, 39, 42, 0.5)',
            borderRadius: '1rem',
            padding: '2rem',
            width: '100%',
            maxWidth: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            border: '1px solid rgba(63, 63, 70, 0.8)',
            backdropFilter: 'blur(20px)',
            position: 'relative',
            zIndex: 1,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}
          onSubmit={(e) => {
            e.preventDefault();
            const name = pendingName.trim();
            if (!name) return;
            localStorage.setItem("sl_displayName", name);
            setDisplayName(name);
          }}
        >
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: '0.5rem',
            color: '#ffffff'
          }}>
            Enter your name to join
          </h1>

          <input
            type="text"
            style={{
              width: '100%',
              padding: '0.875rem',
              borderRadius: '0.75rem',
              background: 'rgba(31, 41, 55, 0.8)',
              color: '#ffffff',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              outline: 'none',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}
            onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = '#dc2626'}
            onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = 'rgba(75, 85, 99, 0.5)'}
            placeholder={`Enter your name to join "${roomName}"`}
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            autoFocus
          />

          <button
            type="submit"
            disabled={!pendingName.trim()}
            style={{
              width: '100%',
              padding: '0.875rem',
              borderRadius: '0.75rem',
              background: !pendingName.trim() ? 'rgba(75, 85, 99, 0.5)' : 'linear-gradient(135deg, #dc2626, #ef4444)',
              color: '#ffffff',
              fontWeight: '600',
              border: 'none',
              cursor: !pendingName.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: !pendingName.trim() ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (pendingName.trim()) {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'linear-gradient(135deg, #b91c1c, #dc2626)';
                target.style.boxShadow = '0 0 20px rgba(220, 38, 38, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (pendingName.trim()) {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'linear-gradient(135deg, #dc2626, #ef4444)';
                target.style.boxShadow = 'none';
              }
            }}
          >
            Join Room
          </button>
        </form>

        <p style={{
          fontSize: '0.875rem',
          textAlign: 'center',
          marginTop: '1rem',
          color: 'rgba(255, 255, 255, 0.7)',
          position: 'relative',
          zIndex: 1,
          maxWidth: '400px',
          lineHeight: 1.5
        }}>
          When you enter the room, tap the microphone and camera icons to enable audio and video.
        </p>

        <img
          src="/logosmall.png"
          alt="StreamLine Logo"
          className="mt-6 w-40 opacity-90"
        />
      </div>
    );
  }

  if (showGoodbye) {
    return <ThankYouScreen showHomeButton={isHost} onHome={handleHomeClick} />;
  }

  // Exit Options Modal for hosts who streamed
  if (showExitOptions) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        backdropFilter: 'blur(5px)'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          width: '100%',
          maxWidth: '500px',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '2rem'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>
              🎬
            </div>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '0.5rem',
              background: 'linear-gradient(to right, #ffffff, #fecaca)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Recording Complete!
            </h2>
            <p style={{
              fontSize: '0.95rem',
              color: '#9ca3af',
              marginTop: '0.75rem'
            }}>
              What would you like to do next?
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {/* Stay & Record Another */}
            <button
              onClick={handleStayAndRecord}
              style={{
                padding: '1.25rem',
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.1) 100%)',
                border: '2px solid rgba(34, 197, 94, 0.5)',
                borderRadius: '0.75rem',
                color: '#10b981',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                fontSize: '1rem',
                fontWeight: '600',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(16, 185, 129, 0.2) 100%)';
                target.style.borderColor = 'rgba(34, 197, 94, 0.8)';
                target.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.3)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.1) 100%)';
                target.style.borderColor = 'rgba(34, 197, 94, 0.5)';
                target.style.boxShadow = 'none';
              }}
            >
              <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>🎯 Stay & Record Another</div>
              <div style={{ fontSize: '0.85rem', color: '#6ee7b7', opacity: 0.9 }}>
                Perfect for multiple episodes, series, or batch recording
              </div>
            </button>

            {/* View Summary & Edit */}
            <button
              onClick={handleViewSummary}
              style={{
                padding: '1.25rem',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
                border: '2px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '0.75rem',
                color: '#3b82f6',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                fontSize: '1rem',
                fontWeight: '600',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.2) 100%)';
                target.style.borderColor = 'rgba(59, 130, 246, 0.8)';
                target.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.3)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)';
                target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                target.style.boxShadow = 'none';
              }}
            >
              <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>📊 View Summary & Edit</div>
              <div style={{ fontSize: '0.85rem', color: '#60a5fa', opacity: 0.9 }}>
                See stats and edit your recording in the timeline editor
              </div>
            </button>

            {/* Leave Room */}
            <button
              onClick={handleLeaveRoom}
              style={{
                padding: '1.25rem',
                background: 'rgba(107, 114, 128, 0.15)',
                border: '2px solid rgba(107, 114, 128, 0.5)',
                borderRadius: '0.75rem',
                color: '#d1d5db',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                fontSize: '1rem',
                fontWeight: '600',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'rgba(107, 114, 128, 0.25)';
                target.style.borderColor = 'rgba(107, 114, 128, 0.8)';
                target.style.boxShadow = '0 0 20px rgba(107, 114, 128, 0.3)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'rgba(107, 114, 128, 0.15)';
                target.style.borderColor = 'rgba(107, 114, 128, 0.5)';
                target.style.boxShadow = 'none';
              }}
            >
              <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>🚪 Leave Room</div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', opacity: 0.9 }}>
                Exit without viewing summary or recording another
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {recordingStatus === "recording" && (
        <div className="fixed bottom-4 left-4 flex items-center gap-2 bg-red-600 px-4 py-3 rounded-lg shadow-lg z-40">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
          <span className="text-sm font-bold">RECORDING</span>
          <span className="text-xs text-gray-200 ml-2">{recordingId}</span>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2 bg-black text-white sl-topbar border-b border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={handleEndStream}
            disabled={recordingStatus === "stopping"}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold text-sm transition disabled:opacity-50"
          >
            {recordingStatus === "stopping" ? "⏳ Exiting..." : "Exit Room"}
          </button>

          <span className="text-sm opacity-80">{roomName}</span>

          {/* Invite Link Button - only for hosts */}
          {isHost && (
            <button
              onClick={() => {
                const inviteUrl = `${window.location.origin}/join?room=${encodeURIComponent(roomName)}`;
                navigator.clipboard.writeText(inviteUrl);
                alert(`Invite link copied to clipboard!\n${inviteUrl}`);
              }}
              style={{
                fontSize: '0.75rem',
                padding: '0.5rem 0.75rem',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '0.375rem',
                background: 'rgba(34, 197, 94, 0.05)',
                color: '#22c55e',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'rgba(34, 197, 94, 0.15)';
                target.style.borderColor = 'rgba(34, 197, 94, 0.8)';
                target.style.boxShadow = '0 0 12px rgba(34, 197, 94, 0.3)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'rgba(34, 197, 94, 0.05)';
                target.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                target.style.boxShadow = 'none';
              }}
              title="Copy invite link to clipboard"
            >
              🔗 Invite
            </button>
          )}

          {/* Stream Timer - only show when streaming */}
          {streamStatus === "live" && (
            <div
              style={{
                fontSize: '0.75rem',
                padding: '0.5rem 0.75rem',
                border: '1px solid rgba(220, 38, 38, 0.4)',
                borderRadius: '0.375rem',
                background: 'rgba(220, 38, 38, 0.05)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backdropFilter: 'blur(10px)',
                fontWeight: '500',
                fontFamily: 'monospace',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}
            >
              🔴 {`${Math.floor(elapsedTime / 60)}:${String(elapsedTime % 60).padStart(2, '0')}`}
            </div>
          )}
        </div>

        {isHost && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setDashboardOpen(true)}
              style={{
                fontSize: '0.75rem',
                padding: '0.5rem 0.75rem',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '0.375rem',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'rgba(255, 255, 255, 0.1)';
                target.style.borderColor = 'rgba(220, 38, 38, 0.6)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'rgba(255, 255, 255, 0.05)';
                target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              }}
            >
              Dashboard
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#ffffff' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: streamStatus === "live" ? "#ef4444" : "#6b7280"
                }}
              />
              <span>{streamStatus === "live" ? "LIVE" : "OFFLINE"}</span>
            </div>

            <button
              onClick={() => setShowStreamSetup(true)}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.75rem',
                borderRadius: '0.375rem',
                background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'linear-gradient(135deg, #b91c1c, #dc2626)';
                target.style.boxShadow = '0 0 15px rgba(220, 38, 38, 0.4)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'linear-gradient(135deg, #dc2626, #ef4444)';
                target.style.boxShadow = 'none';
              }}
            >
              {streamStatus === "live" ? "Manage Stream" : "Setup Stream"}
            </button>
          </div>
        )}
      </div>

      {token && serverUrl && (
        <LiveKitRoom
          data-lk-theme="default"
          className="sl-layout"
          token={token}
          serverUrl={serverUrl}
          connect={true}
          onDisconnected={handleLeftRoom}
          style={{
            width: "100%",
            height: "calc(100vh - 60px)",
            position: "relative",
          }}
        >
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <VideoConference />
            {/* On-stream logo for hosts - visible to viewers */}
            {isHost && (
              <img
                src="/logo.png"
                alt="StreamLine"
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  width: "120px",
                  height: "auto",
                  opacity: "0.75",
                  zIndex: 10,
                  pointerEvents: "none",
                }}
              />
            )}
          </div>

          <RoleOverlay
            open={dashboardOpen}
            onClose={() => setDashboardOpen(false)}
            role="host"
            roomName={roomName}
          />
        </LiveKitRoom>
      )}

      <StreamSetupModal
        isOpen={showStreamSetup}
        onClose={() => setShowStreamSetup(false)}
        onStart={handleStartMultistream}
        onStop={handleStopMultistream}
        status={streamStatus}
      />

      {recordingStatus === "stopped" && recordingId && (
        <StreamEndedModal
          recordingId={recordingId}
          onStartEditing={() => nav(`/editing/editor/new?recordingId=${recordingId}`)}
          onExitRoom={() => nav(`/room-exit/${recordingId}`)}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </>
  );
}
