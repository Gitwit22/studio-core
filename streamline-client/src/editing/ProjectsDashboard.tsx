import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { mockApi, MOCK_ASSETS, MOCK_PROJECTS } from "./mockData";

type Project = (typeof MOCK_PROJECTS)[0];

export default function ProjectsDashboard() {
  const nav = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    mockApi.getProjects().then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    if (!projectName.trim() || !selectedAssetId) {
      alert("Please fill in all fields");
      return;
    }

    const newProject = await mockApi.createProject({
      name: projectName,
      assetId: selectedAssetId,
    });

    setProjects([...projects, newProject]);
    setShowCreateModal(false);
    setProjectName("");
    setSelectedAssetId("");

    nav(`/editing/editor/${newProject.id}`);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">Your Projects</h1>
            <p className="text-gray-400 mt-2">
              {projects.length} / 100 projects used
            </p>
          </div>
          <button
            onClick={() => nav('/join')}
            className="text-sm underline text-gray-400 hover:text-white"
          >
            ← Back
          </button>
        </div>

        {/* New Project Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium mb-8"
        >
          + New Project
        </button>

        {/* Projects Grid */}
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>No projects yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <ProjectCard key={proj.id} project={proj} onDelete={() => setProjects(projects.filter((p) => p.id !== proj.id))} />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Create New Project</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Select asset
                </label>
                <select
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white"
                >
                  <option value="">Choose an asset...</option>
                  {MOCK_ASSETS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Project name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Highlight Reel"
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white placeholder-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setProjectName("");
                  setSelectedAssetId("");
                }}
                className="flex-1 px-4 py-2 border border-gray-600 rounded hover:border-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded font-medium transition"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: () => void;
}) {
  const nav = useNavigate();
  const statusColors = {
    draft: "bg-gray-600",
    rendering: "bg-amber-600",
    complete: "bg-green-600",
  };

  const mins = Math.floor(project.duration / 60);
  const secs = project.duration % 60;

  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden border border-gray-700 hover:border-indigo-500 transition">
      <img
        src="https://placehold.co/320x180"
        alt={project.name}
        className="w-full aspect-video object-cover"
      />
      <div className="p-4">
        <h3 className="font-bold text-lg">{project.name}</h3>
        <div className="flex items-center justify-between mt-2 text-sm text-gray-400">
          <span>
            {mins}:{String(secs).padStart(2, "0")}
          </span>
          <span className={`px-3 py-1 rounded text-white text-xs font-medium ${statusColors[project.status]}`}>
            {project.status}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {new Date(project.lastModified).toLocaleDateString()}
        </p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => nav(`/editing/editor/${project.id}`)}
            className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium transition"
          >
            Open Editor
          </button>
          <button
            onClick={() => alert("Duplicate coming soon")}
            className="px-3 py-2 border border-gray-600 rounded text-sm hover:border-white transition"
          >
            Dup
          </button>
          <button
            onClick={() => {
              if (window.confirm("Delete this project?")) onDelete();
            }}
            className="px-3 py-2 border border-red-600 text-red-400 hover:bg-red-600/20 rounded text-sm transition"
          >
            Del
          </button>
        </div>
      </div>
    </div>
  );
}
