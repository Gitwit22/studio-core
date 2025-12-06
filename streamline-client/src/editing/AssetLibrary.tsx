import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { mockApi, MOCK_ASSETS } from "./mockData";
import { mockRecordingApi, MockRecording } from "../services/mockRecording";

export default function AssetLibrary() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [assets, setAssets] = useState<typeof MOCK_ASSETS>([]);
  const [recordings, setRecordings] = useState<MockRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'stream' | 'upload' | 'recordings'>('all');
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      mockApi.getAssets(),
      mockRecordingApi.getAllRecordings(),
    ]).then(([assetsData, recordingsData]) => {
      setAssets(assetsData);
      setRecordings(recordingsData.filter((r) => r.status === 'ready'));
      setLoading(false);
    });

    const newRecording = searchParams.get('newRecording');
    if (newRecording) {
      setFilter('recordings');
      setTimeout(() => {
        document
          .getElementById(`recording-${newRecording}`)
          ?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [searchParams]);

  const filtered = assets.filter((a) => {
    if (filter !== 'all' && a.source !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredRecordings = recordings.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">Asset Library</h1>
            <p className="text-gray-400 mt-2">
              {filteredRecordings.length} recordings • {filtered.length} assets
            </p>
          </div>
          <button
            onClick={() => nav('/join')}
            className="text-sm underline text-gray-400 hover:text-white"
          >
            ← Back
          </button>
        </div>

        {/* Upload & Create buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => alert('Upload coming soon')}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium"
          >
            + Upload Video
          </button>
          <button
            onClick={() => nav('/editing/projects')}
            className="px-6 py-2 border border-gray-600 hover:border-white rounded-lg font-medium"
          >
            View Projects
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {(
            [
              ['all', 'All Assets'],
              ['stream', 'From Streams'],
              ['upload', 'Uploads'],
              ['recordings', `Recent Streams (${recordings.length})`],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg transition ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'border border-gray-600 text-gray-300 hover:border-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-8 px-4 py-2 bg-zinc-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />

        {/* Recordings Section */}
        {(filter === 'all' || filter === 'recordings') && filteredRecordings.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-4">🎬 Recent Stream Recordings</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredRecordings.map((recording) => (
                <RecordingCard
                  key={recording.id}
                  recording={recording}
                  id={`recording-${recording.id}`}
                  onCreateProject={() =>
                    nav(`/editing/editor/new?recordingId=${recording.id}`)
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Assets Section */}
        {(filter === 'all' || filter === 'stream' || filter === 'upload') && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              📚 {filter === 'all' ? 'All Assets' : filter === 'stream' ? 'From Streams' : 'Uploads'}
            </h2>
            {loading ? (
              <div className="text-gray-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>No assets found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onCreateProject={() =>
                      nav(`/editing/editor/new?assetId=${asset.id}`)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RecordingCard({
  recording,
  id,
  onCreateProject,
}: {
  recording: MockRecording;
  id: string;
  onCreateProject: () => void;
}) {
  const mins = Math.floor(recording.duration / 60);
  const secs = recording.duration % 60;

  return (
    <div
      id={id}
      className="bg-zinc-900 rounded-lg overflow-hidden hover:border border-indigo-500 transition group border-2 border-green-500 shadow-lg shadow-green-500/20"
    >
      <img
        src={recording.thumbnailUrl}
        alt={recording.title}
        className="w-full aspect-video object-cover group-hover:opacity-80 transition"
      />
      <div className="p-3">
        <h3 className="font-medium text-sm truncate text-green-300">
          ✓ {recording.title}
        </h3>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>
            {mins}:{String(secs).padStart(2, '0')}
          </span>
          <span className="bg-green-900 px-2 py-1 rounded text-green-300">
            Ready
          </span>
        </div>
        <button
          onClick={onCreateProject}
          className="w-full mt-3 py-2 bg-green-600 hover:bg-green-700 rounded text-xs font-bold transition text-white"
        >
          ✂️ Edit This
        </button>
      </div>
    </div>
  );
}

function AssetCard({ asset, onCreateProject }: any) {
  const mins = Math.floor(asset.duration / 60);
  const secs = asset.duration % 60;

  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden hover:border border-indigo-500 transition group">
      <img
        src={asset.thumbnail}
        alt={asset.name}
        className="w-full aspect-video object-cover group-hover:opacity-80 transition"
      />
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{asset.name}</h3>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>
            {mins}:{String(secs).padStart(2, '0')}
          </span>
          <span className="bg-zinc-800 px-2 py-1 rounded capitalize">
            {asset.source === "stream" ? "Stream" : "Upload"}
          </span>
        </div>
        <button
          onClick={onCreateProject}
          className="w-full mt-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-xs font-medium transition"
        >
          Create Project
        </button>
      </div>
    </div>
  );
}
