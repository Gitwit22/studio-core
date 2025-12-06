import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { mockApi, MOCK_ASSETS } from "./mockData";
import { mockRecordingApi } from "../services/mockRecording";
import { useEditingFeatures } from "./useEditingFeatures";

type TimelineClip = {
  id: string;
  assetId: string;
  startTime: number;
  duration: number;
  name: string;
  videoUrl?: string;
  originalDuration?: number; // Track original for trim operations
};

type ClipSelection = {
  clipId: string;
  startOffset: number; // ms offset within clip
  endOffset: number; // ms offset within clip
};

export default function EditorPage() {
  const nav = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const { features, getFeatureValue } = useEditingFeatures();

  const [projectName, setProjectName] = useState("");
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [exportResolution, setExportResolution] = useState("720p");
  const [exportFormat, setExportFormat] = useState("mp4");
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId === "new") {
      const recordingId = searchParams.get("recordingId");
      const assetId = searchParams.get("assetId");

      if (recordingId) {
        mockRecordingApi.getRecording(recordingId).then((recording) => {
          if (recording) {
            setProjectName(`Edit: ${recording.title}`);
            setClips([
              {
                id: `clip_${Date.now()}`,
                assetId: recordingId,
                startTime: 0,
                duration: recording.duration,
                name: recording.title,
                videoUrl: recording.videoUrl,
              },
            ]);
          }
        });
      } else if (assetId) {
        const asset = MOCK_ASSETS.find((a) => a.id === assetId);
        if (asset) {
          setProjectName(`New Project from ${asset.name}`);
          setClips([
            {
              id: `clip_${Date.now()}`,
              assetId,
              startTime: 0,
              duration: asset.duration,
              name: asset.name,
            },
          ]);
        }
      }
    } else {
      mockApi.getProject(projectId!).then((proj) => {
        if (proj) {
          setProjectName(proj.name);
          const asset = MOCK_ASSETS.find((a) => a.id === proj.assetId);
          if (asset) {
            setClips([
              {
                id: `clip_1`,
                assetId: proj.assetId,
                startTime: 0,
                duration: asset.duration,
                name: asset.name,
              },
            ]);
          }
        }
      });
    }
  }, [projectId, searchParams]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = playheadTime;
    }
  }, [playheadTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setPlayheadTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);

  const handleSplit = () => {
    const clipAtPlayhead = clips.find(
      (c) =>
        playheadTime >= c.startTime &&
        playheadTime < c.startTime + c.duration
    );

    if (!clipAtPlayhead) {
      alert("Click a clip and then split");
      return;
    }

    const offsetInClip = playheadTime - clipAtPlayhead.startTime;
    const newClips = clips.flatMap((c) => {
      if (c.id !== clipAtPlayhead.id) return [c];

      const clip1: TimelineClip = {
        ...c,
        duration: offsetInClip,
      };

      const clip2: TimelineClip = {
        ...c,
        id: `clip_${Date.now()}`,
        startTime: c.startTime + offsetInClip,
        duration: c.duration - offsetInClip,
      };

      return [clip1, clip2];
    });

    setClips(newClips);
  };

  const handleTrim = () => {
    if (!selectedClipId) {
      alert("Select a clip to trim");
      return;
    }

    const clipIdx = clips.findIndex((c) => c.id === selectedClipId);
    if (clipIdx === -1) return;

    const clip = clips[clipIdx];
    const startOffset = playheadTime - clip.startTime;
    const endOffset = playheadTime - clip.startTime;

    if (startOffset < 0 || endOffset > clip.duration) {
      alert("Playhead must be inside the clip to trim");
      return;
    }

    // Simple trim: remove everything after playhead in this clip
    const trimmedClip = {
      ...clip,
      duration: startOffset,
    };

    const newClips = [...clips];
    newClips[clipIdx] = trimmedClip;
    setClips(newClips);
  };

  const handleDelete = () => {
    if (!selectedClipId) {
      alert("Select a clip to delete");
      return;
    }

    setClips(clips.filter((c) => c.id !== selectedClipId));
    setSelectedClipId(null);
  };

  const handleExport = () => {
    if (clips.length === 0) {
      alert("No clips to export");
      return;
    }

    // Simulate export
    const fileName = `${projectName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.${exportFormat === "mp4" ? "mp4" : "webm"}`;
    alert(
      `Exported project as ${fileName}\nResolution: ${exportResolution}\nFormat: ${exportFormat.toUpperCase()}\n\n(This is a mock - in production this would download the file)`
    );
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const percent = relX / rect.width;
    const newTime = percent * totalDuration;
    setPlayheadTime(Math.max(0, Math.min(newTime, totalDuration)));
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => nav("/editing/projects")}
            className="text-sm underline text-gray-400 hover:text-white"
          >
            ← Projects
          </button>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="px-3 py-1 bg-black border border-gray-600 rounded text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button
          onClick={() => {
            mockApi.saveTimeline(projectId!, clips);
            alert("Project saved!");
          }}
          className="text-xs px-3 py-1 text-gray-300"
        >
          💾 Saving...
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Tools */}
        <div className="w-48 border-r border-gray-700 bg-zinc-950 p-4 overflow-y-auto">
          <h3 className="text-sm font-bold mb-4">Tools</h3>
          <div className="space-y-2">
            <button
              onClick={handleSplit}
              className="w-full px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 rounded transition"
              title="Split at playhead (S)"
            >
              ✂️ Split
            </button>
            <button
              onClick={handleTrim}
              className="w-full px-3 py-2 text-sm border border-gray-600 hover:border-white rounded transition disabled:opacity-50"
              disabled={!selectedClipId}
              title="Trim clip at playhead"
            >
              📏 Trim
            </button>
            <button
              onClick={handleDelete}
              className="w-full px-3 py-2 text-sm border border-red-600 text-red-400 hover:bg-red-600/20 rounded transition disabled:opacity-50"
              disabled={!selectedClipId}
              title="Delete selected clip"
            >
              🗑️ Delete
            </button>
          </div>

          {selectedClipId && (
            <div className="mt-4 p-3 bg-gray-900/50 rounded border border-indigo-500">
              <p className="text-xs text-gray-400 mb-2">
                📌 Clip Selected: {clips.find((c) => c.id === selectedClipId)?.name}
              </p>
              <button
                onClick={() => setSelectedClipId(null)}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Deselect
              </button>
            </div>
          )}

          <h3 className="text-sm font-bold mt-6 mb-4">Effects</h3>
          <div className="text-xs text-gray-500">
            <button
              disabled
              className="w-full px-3 py-2 text-left hover:bg-gray-800 rounded opacity-50"
            >
              Transitions (soon)
            </button>
          </div>

          {/* Feature limits */}
          <div className="mt-8 pt-4 border-t border-gray-700 text-xs text-gray-400">
            <p className="font-medium mb-2">Your Plan</p>
            <div className="space-y-1">
              <div>
                Tracks:{" "}
                <span className="font-semibold">
                  {getFeatureValue("editing.maxTracks")}
                </span>
              </div>
              <div>
                Projects:{" "}
                <span className="font-semibold">
                  {getFeatureValue("editing.maxProjects")}
                </span>
              </div>
              {!getFeatureValue("ai.autocut") && (
                <div className="mt-2 p-2 bg-gray-900 rounded text-gray-500">
                  AI tools locked. Upgrade to Pro.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Panel - Preview + Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video Preview */}
          <div className="flex-1 flex items-center justify-center bg-black p-4 overflow-hidden">
            {clips.length > 0 ? (
              <video
                ref={videoRef}
                src={clips[0].videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4'}
                className="max-h-full max-w-full"
                controls={false}
              />
            ) : (
              <div className="text-gray-500">No video loaded</div>
            )}
          </div>

          {/* Controls */}
          <div className="px-4 py-3 border-t border-gray-700 flex items-center gap-4">
            <button
              onClick={() =>
                videoRef.current &&
                (videoRef.current.paused
                  ? videoRef.current.play()
                  : videoRef.current.pause())
              }
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium"
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <div className="text-sm text-gray-400 font-mono">
              {Math.floor(playheadTime / 60)}:
              {String(Math.floor(playheadTime % 60)).padStart(2, "0")} /{" "}
              {Math.floor(totalDuration / 60)}:
              {String(Math.floor(totalDuration % 60)).padStart(2, "0")}
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
              className="px-2 py-1 border border-gray-600 rounded text-xs"
            >
              −
            </button>
            <span className="text-xs w-8 text-center">{(zoom * 100).toFixed(0)}%</span>
            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.2))}
              className="px-2 py-1 border border-gray-600 rounded text-xs"
            >
              +
            </button>
          </div>

          {/* Timeline */}
          <div className="px-4 py-4 border-t border-gray-700 bg-zinc-950 overflow-x-auto">
            <div
              ref={timelineRef}
              onClick={handleTimelineClick}
              className="relative h-24 bg-black rounded border border-gray-700 cursor-pointer overflow-hidden"
              style={{ minWidth: `${totalDuration / 1000 * 20 * zoom}px` }}
            >
              {/* Time ruler */}
              <div className="absolute top-0 left-0 right-0 h-6 border-b border-gray-700 flex text-[10px] text-gray-500">
                {Array.from({ length: Math.ceil(totalDuration / 10) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="border-r border-gray-700 w-20 flex items-center"
                    >
                      {i * 10}s
                    </div>
                  )
                )}
              </div>

              {/* Clips */}
              <div className="absolute top-6 left-0 w-full h-16">
                {clips.map((clip, idx) => (
                  <div
                    key={clip.id}
                    onClick={() => setSelectedClipId(clip.id)}
                    className={`absolute h-12 rounded border flex items-center justify-center text-xs font-medium overflow-hidden cursor-pointer transition ${
                      selectedClipId === clip.id
                        ? "bg-indigo-500 border-indigo-300 ring-2 ring-indigo-400"
                        : "bg-indigo-600 border-indigo-400 hover:bg-indigo-500"
                    }`}
                    style={{
                      left: `${(clip.startTime / totalDuration) * 100}%`,
                      width: `${(clip.duration / totalDuration) * 100}%`,
                      top: `${idx * 16}px`,
                    }}
                  >
                    <span className="truncate px-2">{clip.name}</span>
                  </div>
                ))}
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
                style={{ left: `${(playheadTime / totalDuration) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Export */}
        <div className="w-64 border-l border-gray-700 bg-zinc-950 p-4 overflow-y-auto">
          <h3 className="text-sm font-bold mb-4">Export</h3>

          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-gray-300 mb-2">Resolution</label>
              <select
                value={exportResolution}
                onChange={(e) => setExportResolution(e.target.value)}
                className="w-full px-2 py-1 bg-black border border-gray-600 rounded text-xs"
              >
                <option value="720p">720p</option>
                <option
                  value="1080p"
                  disabled={getFeatureValue("export.maxResolution") === "720p"}
                >
                  1080p
                </option>
                <option value="4k" disabled={getFeatureValue("export.maxResolution") !== "4k"}>
                  4K
                </option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="w-full px-2 py-1 bg-black border border-gray-600 rounded text-xs"
              >
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
              </select>
            </div>

            <button
              onClick={handleExport}
              disabled={clips.length === 0}
              className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-sm font-medium rounded transition"
            >
              ⬇️ Export Project
            </button>

            <div className="mt-6 pt-4 border-t border-gray-700 text-xs text-gray-400">
              <div className="font-medium mb-2">Project Info</div>
              <div>Duration: {Math.floor(totalDuration / 60)}m</div>
              <div>Clips: {clips.length}</div>
              <div className="mt-1 text-gray-500">Last saved: now</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
