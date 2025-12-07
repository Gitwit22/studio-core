import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRecordingProgress } from '../hooks/useRecordingProgress';
import { mockRecordingApi } from '../services/mockRecording';

export default function StreamSummaryPage() {
  const { recordingId } = useParams<{ recordingId: string }>();
  const nav = useNavigate();
  const { recording, loading } = useRecordingProgress(recordingId);
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrivacy, setEditPrivacy] = useState('public');

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading summary...</p>
        </div>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">❌ Recording not found</p>
          <button
            onClick={() => nav('/join')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleOpenMetadataEditor = () => {
    setEditTitle(recording.title);
    setEditDescription((recording as any).description || '');
    setEditPrivacy((recording as any).privacy || 'public');
    setShowMetadataEditor(true);
  };

  const handleSaveMetadata = () => {
    const updatedRecording = {
      ...recording,
      title: editTitle,
      description: editDescription,
      privacy: editPrivacy,
    };

    // Update in localStorage
    const recordings = JSON.parse(localStorage.getItem('sl_recordings') || '[]');
    const idx = recordings.findIndex((r: any) => r.id === recording.id);
    if (idx !== -1) {
      recordings[idx] = updatedRecording;
      localStorage.setItem('sl_recordings', JSON.stringify(recordings));
    }

    setShowMetadataEditor(false);
    window.location.reload(); // Refresh to show updated title
  };

  const statusConfig = {
    recording: {
      label: '🔴 Recording',
      color: 'bg-red-600',
      icon: '⟳',
      animate: true,
    },
    processing: {
      label: '⏳ Processing',
      color: 'bg-amber-600',
      icon: '⟳',
      animate: true,
    },
    ready: {
      label: '✅ Ready!',
      color: 'bg-green-600',
      icon: '✓',
      animate: false,
    },
    failed: {
      label: '❌ Failed',
      color: 'bg-red-900',
      icon: '✕',
      animate: false,
    },
  };

  const config = statusConfig[recording.status];
  const mins = Math.floor(recording.duration / 60);
  const secs = recording.duration % 60;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={() => nav('/join')}
          className="mb-8 text-sm underline text-gray-400 hover:text-white transition"
        >
          ← Back to Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{recording.title}</h1>
          <p className="text-gray-400">
            {new Date(recording.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Recording Status Card */}
        <div className="bg-zinc-900 rounded-lg p-8 mb-8 border border-gray-700">
          <h2 className="font-bold text-xl mb-6">📹 Recording Status</h2>

          <div className="flex items-start gap-6">
            <div
              className={`w-16 h-16 rounded-full ${config.color} flex items-center justify-center text-3xl flex-shrink-0 ${config.animate ? 'animate-spin' : ''}`}
            >
              {config.icon}
            </div>

            <div className="flex-1">
              <p className="font-bold text-2xl mb-2">{config.label}</p>

              {/* Processing Progress Bar */}
              {recording.status === 'processing' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">Encoding video...</p>
                    <span className="text-sm font-semibold text-indigo-400">
                      {recording.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-black rounded-full h-3 overflow-hidden border border-gray-700">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-full transition-all duration-300"
                      style={{ width: `${recording.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    This usually takes 3-5 minutes for longer videos
                  </p>
                </div>
              )}

              {/* Error Message */}
              {recording.status === 'failed' && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded">
                  <p className="text-red-300 text-sm">{recording.error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons - Show when ready */}
          {recording.status === 'ready' && (
            <div className="mt-8 pt-8 border-t border-gray-700 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <p className="text-green-300 font-medium">
                  Your recording is ready to edit!
                </p>
              </div>

              <button
                onClick={() => nav(`/editing/assets?newRecording=${recording.id}`)}
                className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold text-lg transition transform hover:scale-105"
              >
                ✂️ Edit in StreamLine
              </button>

              <button
                onClick={handleOpenMetadataEditor}
                className="w-full px-6 py-3 border border-indigo-600 hover:bg-indigo-600/10 rounded-lg font-medium transition"
              >
                ✏️ Edit Details
              </button>

              <button
                onClick={() => nav('/editing/assets')}
                className="w-full px-6 py-3 border-2 border-indigo-600 hover:bg-indigo-600/10 rounded-lg font-bold transition"
              >
                📚 View Asset Library
              </button>

              <a
                href={recording.videoUrl}
                download={`${recording.title}.mp4`}
                className="block w-full px-6 py-3 border border-gray-600 hover:border-white text-center rounded-lg font-medium transition"
              >
                📥 Download MP4
              </a>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Duration"
            value={`${mins}m ${secs}s`}
            icon="⏱️"
          />
          <StatCard
            label="Viewers"
            value={recording.viewerCount.toString()}
            icon="👥"
          />
          <StatCard
            label="Peak Viewers"
            value={recording.peakViewers.toString()}
            icon="📈"
          />
          <StatCard
            label="Status"
            value={config.label}
            icon="🎬"
          />
        </div>

        {/* Recording Details */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-gray-700">
          <h3 className="font-bold mb-4">📋 Recording Details</h3>
          <div className="space-y-3 text-sm">
            <DetailRow label="Recording ID" value={recording.id} />
            <DetailRow label="Room" value={recording.roomName} />
            <DetailRow
              label="Created"
              value={new Date(recording.createdAt).toLocaleString()}
            />
            <DetailRow label="Video URL" value={recording.videoUrl} copyable />
          </div>
        </div>

        {/* Metadata Editor Modal */}
        {showMetadataEditor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-lg border border-gray-700 max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-6">Edit Recording Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-black border border-gray-600 rounded-lg focus:outline-none focus:border-indigo-500"
                    placeholder="Recording title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-4 py-2 bg-black border border-gray-600 rounded-lg focus:outline-none focus:border-indigo-500 h-24 resize-none"
                    placeholder="Add notes or description (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Privacy
                  </label>
                  <select
                    value={editPrivacy}
                    onChange={(e) => setEditPrivacy(e.target.value)}
                    className="w-full px-4 py-2 bg-black border border-gray-600 rounded-lg focus:outline-none focus:border-indigo-500"
                  >
                    <option value="public">🌍 Public</option>
                    <option value="unlisted">🔗 Unlisted</option>
                    <option value="private">🔒 Private</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowMetadataEditor(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 hover:border-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMetadata}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-zinc-900 rounded-lg p-4 border border-gray-700 hover:border-indigo-500 transition">
      <p className="text-sm text-gray-400 mb-2">{icon} {label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  copyable,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800">
      <span className="text-gray-400">{label}:</span>
      <div className="flex items-center gap-2">
        <span className="text-right text-gray-300 truncate max-w-xs">
          {value.length > 40 ? value.substring(0, 40) + '...' : value}
        </span>
        {copyable && (
          <button
            onClick={handleCopy}
            className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded transition"
          >
            {copied ? '✓' : '📋'}
          </button>
        )}
      </div>
    </div>
  );
}
