import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { mockRecordingApi } from "../services/mockRecording";
import { mockApi } from "../editing/mockData";

type Recording = {
  id: string;
  title: string;
  status: "recording" | "processing" | "ready";
  progress: number;
  duration: number;
  viewerCount: number;
  peakViewers: number;
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  assetId: string;
  createdAt: string;
  duration?: number;
};

export default function Dashboard() {
  const nav = useNavigate();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<any>(null);
  const [totalViewers, setTotalViewers] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  useEffect(() => {
    const userStr = localStorage.getItem("sl_user");
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUser(userData);
    }

    // Load recordings
    const allRecordings = mockRecordingApi.listRecordings();
    setRecordings(allRecordings);

    // Calculate stats
    const totalViewCount = allRecordings.reduce(
      (sum, r) => sum + (r.peakViewers || 0),
      0
    );
    setTotalViewers(totalViewCount);

    const totalDurationMinutes = allRecordings.reduce(
      (sum, r) => sum + (r.duration || 0),
      0
    );
    setTotalDuration(totalDurationMinutes / 60);

    // Load projects
    const allProjects = mockApi.listProjects();
    setProjects(allProjects);
  }, []);

  const readyRecordings = recordings.filter((r) => r.status === "ready");
  const processingRecordings = recordings.filter((r) => r.status === "processing");

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome back, {user?.displayName || "Streamer"}! 👋
            </h1>
            <p className="text-gray-400 mt-1">
              {user?.plan?.toUpperCase() || "FREE"} Plan
            </p>
          </div>
          <button
            onClick={() => nav("/join")}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium"
          >
            + New Stream
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-6">
        <StatCard
          label="Recordings"
          value={recordings.length}
          detail={`${readyRecordings.length} ready`}
          color="indigo"
        />
        <StatCard
          label="Total Viewers"
          value={totalViewers.toLocaleString()}
          detail="Peak viewers"
          color="green"
        />
        <StatCard
          label="Total Minutes"
          value={Math.round(totalDuration).toLocaleString()}
          detail="Streamed"
          color="blue"
        />
        <StatCard
          label="Projects"
          value={projects.length}
          detail="Edited"
          color="purple"
        />
      </div>

      {/* Recent Recordings */}
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Recent Recordings</h2>
          <button
            onClick={() => nav("/editing/assets")}
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            View All →
          </button>
        </div>

        {recordings.length === 0 ? (
          <div className="bg-zinc-900 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No recordings yet</p>
            <button
              onClick={() => nav("/join")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded"
            >
              Start your first stream
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recordings.slice(0, 6).map((rec) => (
              <RecordingCard
                key={rec.id}
                recording={rec}
                onEdit={() =>
                  nav(
                    `/stream-summary/${rec.id}`
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Projects */}
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Recent Projects</h2>
          <button
            onClick={() => nav("/editing/projects")}
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            View All →
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-zinc-900 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No projects yet</p>
            <button
              onClick={() => nav("/editing/assets")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {projects.slice(0, 8).map((proj) => (
              <ProjectCard
                key={proj.id}
                project={proj}
                onEdit={() => nav(`/editing/editor/${proj.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string | number;
  detail: string;
  color: "indigo" | "green" | "blue" | "purple";
}) {
  const bgColors = {
    indigo: "bg-indigo-900/40",
    green: "bg-green-900/40",
    blue: "bg-blue-900/40",
    purple: "bg-purple-900/40",
  };

  const borderColors = {
    indigo: "border-indigo-500",
    green: "border-green-500",
    blue: "border-blue-500",
    purple: "border-purple-500",
  };

  return (
    <div
      className={`${bgColors[color]} border ${borderColors[color]} rounded-lg p-4`}
    >
      <p className="text-gray-400 text-sm mb-2">{label}</p>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function RecordingCard({
  recording,
  onEdit,
}: {
  recording: Recording;
  onEdit: () => void;
}) {
  const statusColors = {
    recording: "bg-red-500/20 text-red-300",
    processing: "bg-yellow-500/20 text-yellow-300",
    ready: "bg-green-500/20 text-green-300",
  };

  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden hover:border-indigo-500 border border-gray-700 transition">
      <div className="aspect-video bg-black flex items-center justify-center">
        <div className="text-5xl">🎬</div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold truncate mb-2">{recording.title}</h3>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs px-2 py-1 rounded ${statusColors[recording.status]}`}>
            {recording.status === "recording" && "🔴 Recording"}
            {recording.status === "processing" && "⏳ Processing"}
            {recording.status === "ready" && "✅ Ready"}
          </span>
          <span className="text-xs text-gray-400">
            {Math.round(recording.duration / 60)}m
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          👥 {recording.peakViewers} viewers
        </p>
        {recording.status === "processing" && (
          <div className="w-full bg-gray-700 rounded h-1.5 mb-3">
            <div
              className="bg-indigo-600 h-1.5 rounded transition-all"
              style={{ width: `${recording.progress}%` }}
            />
          </div>
        )}
        <button
          onClick={onEdit}
          className="w-full py-2 text-sm bg-indigo-600 hover:bg-indigo-700 rounded font-medium"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onEdit,
}: {
  project: Project;
  onEdit: () => void;
}) {
  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden hover:border-indigo-500 border border-gray-700 transition">
      <div className="aspect-video bg-black flex items-center justify-center">
        <div className="text-5xl">📽️</div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold truncate mb-2">{project.name}</h3>
        <p className="text-xs text-gray-500 mb-3">
          {new Date(project.createdAt).toLocaleDateString()}
        </p>
        <button
          onClick={onEdit}
          className="w-full py-2 text-sm bg-indigo-600 hover:bg-indigo-700 rounded font-medium"
        >
          Open
        </button>
      </div>
    </div>
  );
}
