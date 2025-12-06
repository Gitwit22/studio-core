import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mockRecordingApi } from "../services/mockRecording";

export default function RoomExitPage() {
  const nav = useNavigate();
  const { recordingId } = useParams<{ recordingId: string }>();
  const [recording, setRecording] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // If we have a recordingId and user just called Exit Room, they're the host
  const isHost = !!recordingId;

  useEffect(() => {
    if (recordingId) {
      const rec = mockRecordingApi.getRecording(recordingId);
      setRecording(rec);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [recordingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isHost) {
    // Guest view
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-4">Thanks for joining!</h1>
          <p className="text-gray-300 mb-8">
            The stream has ended. You can now close this window or go back to the home page.
          </p>
          <button
            onClick={() => nav("/join")}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Host view
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Recording Info */}
        <div className="bg-zinc-900 rounded-lg p-6 mb-8 border border-zinc-700">
          <h1 className="text-2xl font-bold mb-2">Stream Ended</h1>
          <p className="text-gray-300 mb-4">
            Your recording is being processed. You can now edit it or save it for later.
          </p>

          {recording && (
            <div className="bg-zinc-800 rounded p-4 mb-4 space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Title:</span> {recording.title}
              </div>
              <div>
                <span className="text-gray-400">Duration:</span> {Math.round(recording.duration / 60)}m
              </div>
              <div>
                <span className="text-gray-400">Status:</span>{" "}
                <span className="text-green-400 font-semibold capitalize">{recording.status}</span>
              </div>
              {recording.progress !== undefined && (
                <div>
                  <span className="text-gray-400">Progress:</span> {recording.progress}%
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => nav(`/stream-summary/${recordingId}`)}
            className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition text-lg"
          >
            ✂️ Go to Editor
          </button>

          <div className="bg-red-600 hover:bg-red-700 rounded-lg p-4 cursor-pointer transition"
            onClick={() => {
              // Delete the recording
              if (recordingId) {
                mockRecordingApi.deleteRecording(recordingId);
              }
              alert("Stream downloaded and removed from cloud. Saved locally.");
              nav("/join");
            }}
          >
            <div className="font-semibold text-lg">📥 Download Stream</div>
            <div className="text-xs mt-2 text-red-100">
              ⚠️ Download now or it's gone forever
            </div>
          </div>

          <button
            onClick={() => nav("/join")}
            className="w-full px-6 py-3 border border-gray-600 text-gray-300 hover:bg-zinc-800 rounded-lg font-semibold transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
