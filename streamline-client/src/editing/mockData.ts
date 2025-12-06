export const MOCK_ASSETS = [
  {
    id: "asset_1",
    name: "Stream Recording - Jan 15",
    duration: 3600,
    source: "stream" as const,
    thumbnail: "https://placehold.co/320x180",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "asset_2",
    name: "Upload - Intro Video",
    duration: 120,
    source: "upload" as const,
    thumbnail: "https://placehold.co/320x180",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "asset_3",
    name: "Stream Recording - Jan 10",
    duration: 5400,
    source: "stream" as const,
    thumbnail: "https://placehold.co/320x180",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "asset_4",
    name: "Tutorial - Getting Started",
    duration: 1800,
    source: "upload" as const,
    thumbnail: "https://placehold.co/320x180",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "asset_5",
    name: "Stream Recording - Jan 5",
    duration: 7200,
    source: "stream" as const,
    thumbnail: "https://placehold.co/320x180",
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const MOCK_PROJECTS = [
  {
    id: "proj_1",
    name: "Highlights Reel",
    assetId: "asset_1",
    status: "draft" as const,
    lastModified: new Date().toISOString(),
    duration: 3600,
  },
  {
    id: "proj_2",
    name: "Intro Compilation",
    assetId: "asset_2",
    status: "complete" as const,
    lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    duration: 120,
  },
  {
    id: "proj_3",
    name: "Best Moments",
    assetId: "asset_3",
    status: "rendering" as const,
    lastModified: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    duration: 900,
  },
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockApi = {
  getAssets: async () => {
    await delay(500);
    return MOCK_ASSETS;
  },
  getProjects: async () => {
    await delay(500);
    return MOCK_PROJECTS;
  },
  listProjects: () => {
    // Synchronous version for dashboard
    return MOCK_PROJECTS;
  },
  getProject: async (id: string) => {
    await delay(500);
    return MOCK_PROJECTS.find((p) => p.id === id) || null;
  },
  createProject: async (data: any) => {
    await delay(1000);
    const newId = `proj_${Date.now()}`;
    return { id: newId, ...data, status: "draft", lastModified: new Date().toISOString() };
  },
  saveTimeline: async (id: string, timeline: any) => {
    await delay(1000);
    return { saved: true };
  },
  startExport: async (projectId: string, settings: any) => {
    await delay(1000);
    return { exportId: `export_${Date.now()}`, status: "queued", estimatedTime: 180 };
  },
};
