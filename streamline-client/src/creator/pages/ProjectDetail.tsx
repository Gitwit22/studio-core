import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getProject,
  listProjectAssets,
  deleteProjectAsset,
  type Project,
  type ProjectAsset,
} from "../../lib/projectsApi";
import { API_BASE } from "../../lib/apiBase";
import { apiFetchAuth } from "../../lib/api";

/**
 * ProjectDetail — Displays a single project with its assets (recordings,
 * uploads, renders). Entry point for editing a project.
 *
 * Route: /projects/:projectId
 */
export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const nav = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getProject(projectId), listProjectAssets(projectId)])
      .then(([proj, assetList]) => {
        if (cancelled) return;
        setProject(proj);
        setAssets(assetList);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Failed to load project");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleDeleteAsset = async (assetId: string) => {
    if (!projectId) return;
    try {
      await deleteProjectAsset(projectId, assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      setProject((prev) =>
        prev ? { ...prev, assetCount: Math.max(0, prev.assetCount - 1) } : prev,
      );
    } catch {
      // silent
    }
  };

  const handleDownload = async (asset: ProjectAsset) => {
    if (!asset.sourceRecordingId) return;
    try {
      const res = await apiFetchAuth(
        `${API_BASE}/api/recordings/${encodeURIComponent(asset.sourceRecordingId)}/download-link`,
      );
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    } catch {
      // silent
    }
  };

  function formatSize(bytes: number | null): string {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function formatDuration(sec: number | null): string {
    if (!sec) return "—";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const typeLabel: Record<string, string> = {
    recording: "🎥 Recording",
    upload: "📤 Upload",
    render: "🎞️ Render",
    clip: "✂️ Clip",
    thumbnail: "🖼️ Thumbnail",
    transcript: "📄 Transcript",
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: "#9ca3af", textAlign: "center", paddingTop: "120px" }}>
          Loading project…
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={pageStyle}>
        <div style={{ color: "#ef4444", textAlign: "center", paddingTop: "120px" }}>
          {error || "Project not found"}
        </div>
        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <button onClick={() => nav("/projects")} style={linkBtnStyle}>
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          padding: "48px 24px 24px",
        }}
      >
        <button onClick={() => nav("/projects")} style={linkBtnStyle}>
          ← Back to Projects
        </button>

        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "#fff",
            margin: "16px 0 4px",
          }}
        >
          {project.name}
        </h1>

        <div style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "8px" }}>
          {project.assetCount} asset{project.assetCount === 1 ? "" : "s"}
          {project.sourceRoomName && <> · Room: {project.sourceRoomName}</>}
        </div>

        {/* Edit button — only if there are recording/upload assets */}
        {assets.some((a) => a.type === "recording" || a.type === "upload") && (
          <button
            onClick={() => {
              // Navigate to the editing editor for this project (if editing is enabled)
              // Uses the existing editing_projects model via the editing route
              nav(`/editing/editor/${project.id}`);
            }}
            style={{
              marginTop: "8px",
              padding: "10px 20px",
              background: "linear-gradient(to right, #dc2626, #ef4444)",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
          >
            ✏️ Edit Project
          </button>
        )}

        {/* Assets list */}
        <div style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginBottom: "16px" }}>
            Assets
          </h2>

          {assets.length === 0 && (
            <div
              style={{
                color: "#6b7280",
                fontSize: "13px",
                textAlign: "center",
                padding: "32px 16px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              No assets yet. Recordings will appear here automatically.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {assets.map((asset) => (
              <div
                key={asset.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#fff",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {typeLabel[asset.type] || asset.type} — {asset.filename}
                  </div>
                  <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                    {formatDuration(asset.duration)} · {formatSize(asset.size)}
                    {asset.processingStatus !== "ready" && (
                      <span
                        style={{
                          marginLeft: "8px",
                          color:
                            asset.processingStatus === "failed"
                              ? "#ef4444"
                              : "#f59e0b",
                        }}
                      >
                        ({asset.processingStatus})
                      </span>
                    )}
                  </div>
                </div>

                {/* Download (recordings only) */}
                {asset.sourceRecordingId && asset.processingStatus === "ready" && (
                  <button
                    onClick={() => handleDownload(asset)}
                    style={actionBtnStyle}
                    title="Download"
                  >
                    ⬇
                  </button>
                )}

                {/* Delete */}
                <button
                  onClick={() => handleDeleteAsset(asset.id)}
                  style={{ ...actionBtnStyle, color: "#ef4444" }}
                  title="Remove asset"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0a0a",
  color: "#fff",
  fontFamily: "Inter, system-ui, sans-serif",
};

const linkBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#9ca3af",
  fontSize: "13px",
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
};

const actionBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "6px",
  color: "#d1d5db",
  cursor: "pointer",
  fontSize: "14px",
  padding: "6px 10px",
  transition: "all 0.2s",
};
