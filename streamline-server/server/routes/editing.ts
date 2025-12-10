import { Router, Request, Response } from "express";
import { firestore as db } from "../firebaseAdmin";
import jwt from "jsonwebtoken";
import multer from "multer";
import { uploadVideo, getSignedDownloadUrl } from "../lib/storageClient";
import { checkStorageLimit, updateStorageUsage } from "../usageHelper";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// Configure multer for memory storage (files stored in RAM temporarily)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

// Middleware to verify JWT and extract user info
const authenticateToken = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  // Dev mode: Allow requests without token
  if (!token) {
    // In development, use a default user
    if (process.env.NODE_ENV !== "production") {
      req.user = { id: "dev-user", planId: "pro" };
      return next();
    }
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: decoded.id, planId: decoded.plan };
    next();
  } catch (err) {
    // Dev mode: Allow requests with invalid tokens
    if (process.env.NODE_ENV !== "production") {
      req.user = { id: "dev-user", planId: "pro" };
      return next();
    }
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; planId: string };
    }
  }
}

// POST /api/editing/upload - Upload video files with multer middleware
router.post("/upload", authenticateToken, upload.single('video'), async (req: Request, res: Response) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.user?.id;
    const { title } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    // ✅ Validate file type on backend (never trust frontend)
    if (!req.file.mimetype.startsWith('video/')) {
      return res.status(400).json({ error: "Invalid file type. Only video files are allowed." });
    }

    // ✅ Check storage limits before upload
    await checkStorageLimit(userId, req.file.size);

    // ✅ Upload file buffer to R2/S3
    const fileName = `${Date.now()}-${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
    const path = `uploads/${userId}/${fileName}`;
    
    const publicUrl = await uploadVideo(
      req.file.buffer,
      path,
      req.file.mimetype
    );

    // ✅ Update storage usage
    await updateStorageUsage(userId, req.file.size);

    // ✅ Create asset record in Firestore
    const assetRef = await db.collection('editing_assets').add({
      id: `asset_${Date.now()}`,
      userId,
      name: title,
      type: 'video',
      fileSize: req.file.size,
      videoUrl: publicUrl,
      storagePath: path,
      duration: 0, // Can be extracted with ffmpeg later
      thumbnail: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      source: 'upload'
    });

    console.log(`✅ Video uploaded: ${title} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);

    res.json({
      ok: true,
      assetId: assetRef.id,
      message: "File uploaded successfully",
      publicUrl,
      storagePath: path,
      fileSize: req.file.size
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    
    // Handle specific error cases
    if (err.message.includes('exceeds')) {
      return res.status(413).json({ error: "File size exceeds maximum allowed" });
    }
    
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

// ============================================================================
// ASSETS API ENDPOINTS - Maps to recordings converted to assets
// ============================================================================

// GET /api/editing/assets - Get all user's assets (converted recordings)
router.get("/assets", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch all recordings for this user and convert to assets format
    const recordingsSnap = await db
      .collection("recordings")
      .where("userId", "==", userId)
      .get();

    const assets = recordingsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id || doc.id,
        name: data.title || "Untitled",
        duration: data.duration || 0,
        source: "stream" as const,
        thumbnail: data.thumbnailUrl || "",
        videoUrl: data.videoUrl || data.publicExportUrl,
        fileSize: data.fileSize,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        userId: data.userId,
      };
    });

    res.json(assets);
  } catch (err: any) {
    console.error("assets list error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// GET /api/editing/assets/:id - Get single asset by ID
router.get("/assets/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const recordingSnap = await db.collection("recordings").doc(id).get();

    if (!recordingSnap.exists) {
      return res.status(404).json({ error: "Asset not found" });
    }

    const data = recordingSnap.data();

    // Verify ownership
    if (data?.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const asset = {
      id: data?.id || recordingSnap.id,
      name: data?.title || "Untitled",
      duration: data?.duration || 0,
      source: "stream" as const,
      thumbnail: data?.thumbnailUrl || "",
      videoUrl: data?.videoUrl || data?.publicExportUrl,
      fileSize: data?.fileSize,
      createdAt: data?.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      userId: data?.userId,
    };

    res.json(asset);
  } catch (err: any) {
    console.error("get asset error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// DELETE /api/editing/assets/:id - Delete an asset
router.delete("/assets/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const recordingSnap = await db.collection("recordings").doc(id).get();

    if (!recordingSnap.exists) {
      return res.status(404).json({ error: "Asset not found" });
    }

    const data = recordingSnap.data();

    // Verify ownership
    if (data?.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Delete from Firestore
    await db.collection("recordings").doc(id).delete();

    res.json({ ok: true, message: "Asset deleted" });
  } catch (err: any) {
    console.error("delete asset error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// POST /api/editing/assets/from-recording - Convert recording to asset
router.post("/assets/from-recording", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { recordingId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!recordingId) {
      return res.status(400).json({ error: "recordingId is required" });
    }

    const recordingSnap = await db.collection("recordings").doc(recordingId).get();

    if (!recordingSnap.exists) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const data = recordingSnap.data();

    // Verify ownership
    if (data?.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const asset = {
      id: data?.id || recordingSnap.id,
      name: data?.title || "Untitled",
      duration: data?.duration || 0,
      source: "stream" as const,
      thumbnail: data?.thumbnailUrl || "",
      videoUrl: data?.videoUrl || data?.publicExportUrl,
      fileSize: data?.fileSize,
      createdAt: data?.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      userId: data?.userId,
    };

    res.json(asset);
  } catch (err: any) {
    console.error("convert recording error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ============================================================================
// PROJECTS API ENDPOINTS - Maps to saved editing projects
// ============================================================================

// GET /api/editing/projects - Get all user's projects
router.get("/projects", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch all projects for this user
    const projectsSnap = await db
      .collection("projects")
      .where("userId", "==", userId)
      .get();

    const projects = projectsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id || doc.id,
        name: data.name || "Untitled Project",
        assetId: data.assetId || "",
        status: data.status || "draft",
        lastModified: data.lastModified?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        duration: data.duration || 0,
        thumbnail: data.thumbnail || "",
        userId: data.userId,
        timeline: data.timeline,
      };
    });

    res.json(projects);
  } catch (err: any) {
    console.error("projects list error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// GET /api/editing/projects/:id - Get single project by ID
router.get("/projects/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projectSnap = await db.collection("projects").doc(id).get();

    if (!projectSnap.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    const data = projectSnap.data();

    // Verify ownership
    if (data?.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const project = {
      id: data?.id || projectSnap.id,
      name: data?.name || "Untitled Project",
      assetId: data?.assetId || "",
      status: data?.status || "draft",
      lastModified: data?.lastModified?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      duration: data?.duration || 0,
      thumbnail: data?.thumbnail || "",
      userId: data?.userId,
      timeline: data?.timeline,
    };

    res.json(project);
  } catch (err: any) {
    console.error("get project error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// POST /api/editing/projects - Create new project
router.post("/projects", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, assetId, timeline } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!name || !assetId) {
      return res.status(400).json({ error: "name and assetId are required" });
    }

    const projectRef = db.collection("projects").doc();
    const projectData = {
      id: projectRef.id,
      userId,
      name,
      assetId,
      status: "draft",
      duration: 0,
      timeline: timeline || null,
      createdAt: new Date(),
      lastModified: new Date(),
    };

    await projectRef.set(projectData);

    const project = {
      id: projectData.id,
      name: projectData.name,
      assetId: projectData.assetId,
      status: projectData.status,
      lastModified: projectData.lastModified.toISOString(),
      duration: projectData.duration,
      thumbnail: "",
      userId: projectData.userId,
      timeline: projectData.timeline,
    };

    res.json(project);
  } catch (err: any) {
    console.error("create project error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// PUT /api/editing/projects/:id - Update project
router.put("/projects/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, timeline, status, duration, thumbnail } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projectSnap = await db.collection("projects").doc(id).get();

    if (!projectSnap.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    const data = projectSnap.data();

    // Verify ownership
    if (data?.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const updateData: any = { lastModified: new Date() };
    if (name !== undefined) updateData.name = name;
    if (timeline !== undefined) updateData.timeline = timeline;
    if (status !== undefined) updateData.status = status;
    if (duration !== undefined) updateData.duration = duration;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;

    await db.collection("projects").doc(id).update(updateData);

    const updatedData = { ...data, ...updateData };
    const project = {
      id: updatedData.id || id,
      name: updatedData.name || "Untitled Project",
      assetId: updatedData.assetId || "",
      status: updatedData.status || "draft",
      lastModified: updateData.lastModified.toISOString(),
      duration: updatedData.duration || 0,
      thumbnail: updatedData.thumbnail || "",
      userId: updatedData.userId,
      timeline: updatedData.timeline,
    };

    res.json(project);
  } catch (err: any) {
    console.error("update project error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// DELETE /api/editing/projects/:id - Delete project
router.delete("/projects/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projectSnap = await db.collection("projects").doc(id).get();

    if (!projectSnap.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    const data = projectSnap.data();

    // Verify ownership
    if (data?.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await db.collection("projects").doc(id).delete();

    res.json({ ok: true, message: "Project deleted" });
  } catch (err: any) {
    console.error("delete project error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// GET /api/editing/list - Get all recordings for the authenticated user
router.get("/list", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    let userId: string | null = null;

    // If token provided, use it; otherwise fetch all recordings for testing
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userId = decoded.id;
      } catch (err) {
        // Invalid token, will fetch all recordings
        userId = null;
      }
    }

    let query: any = db.collection("recordings");
    
    // If we have a valid user ID, filter by it
    if (userId) {
      query = query.where("userId", "==", userId);
    }

    const recordingsSnap = await query.get();

    const recordings = recordingsSnap.docs
      .map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a: any, b: any) => {
        // Sort by createdAt descending in memory
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });

    res.json(recordings);
  } catch (err) {
    console.error("list error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/editing/save - Save edit configuration for a recording
router.post("/save", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { recordingId, editConfig } = req.body;
    const userId = req.user?.id;

    if (!userId || !recordingId) {
      return res.status(400).json({ error: "recordingId is required" });
    }

    // Verify ownership
    const recordingSnap = await db.collection("recordings").doc(recordingId).get();

    if (!recordingSnap.exists) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const recordingData = recordingSnap.data() as any;
    if (recordingData.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Save edit config
    await db.collection("recordings").doc(recordingId).update({
      editConfig,
      updatedAt: new Date(),
    });

    res.json({ ok: true, message: "Edit config saved" });
  } catch (err) {
    console.error("save error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/editing/:recordingId - Update recording metadata (duration, status, viewer count)
router.put("/:recordingId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;
    const { duration, status, viewerCount, peakViewers } = req.body;
    const userId = req.user?.id;

    if (!userId || !recordingId) {
      return res.status(400).json({ error: "recordingId is required" });
    }

    // Verify ownership
    const recordingSnap = await db.collection("recordings").doc(recordingId).get();

    if (!recordingSnap.exists) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const recordingData = recordingSnap.data() as any;
    if (recordingData.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Update recording metadata
    const updateData: any = { updatedAt: new Date() };
    if (typeof duration === 'number') updateData.duration = duration;
    if (status) updateData.status = status;
    if (typeof viewerCount === 'number') updateData.viewerCount = viewerCount;
    if (typeof peakViewers === 'number') updateData.peakViewers = peakViewers;

    await db.collection("recordings").doc(recordingId).update(updateData);

    console.log("✅ Recording updated:", { recordingId, ...updateData });

    res.json({
      ok: true,
      message: "Recording updated successfully",
      recording: { id: recordingId, ...updateData },
    });
  } catch (err: any) {
    console.error("❌ update recording error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// POST /api/editing/render - Trigger render job for a recording
router.post("/render", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { recordingId, renderedBuffer } = req.body;
    const userId = req.user?.id;

    if (!userId || !recordingId) {
      return res.status(400).json({ error: "recordingId is required" });
    }

    // Verify ownership
    const recordingSnap = await db.collection("recordings").doc(recordingId).get();

    if (!recordingSnap.exists) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const recordingData = recordingSnap.data() as any;
    if (recordingData.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Update recording status to "rendering"
    await db.collection("recordings").doc(recordingId).update({
      status: "rendering",
      renderStartedAt: new Date(),
    });

    // ✅ PROMPT #4: When export finishes, upload rendered video to R2
    if (renderedBuffer) {
      try {
        const buffer = Buffer.from(renderedBuffer);
        
        // Check storage limit
        await checkStorageLimit(userId, buffer.byteLength);

        // Upload to R2
        const exportPath = `exports/${userId}/${recordingId}/${Date.now()}.mp4`;
        const publicUrl = await uploadVideo(buffer, exportPath, "video/mp4");

        // Update storage usage
        await updateStorageUsage(userId, buffer.byteLength);

        // Update recording with rendered path and URL
        await db.collection("recordings").doc(recordingId).update({
          status: "complete",
          renderedPath: exportPath,
          publicExportUrl: publicUrl,
          renderedAt: new Date(),
        });

        return res.json({
          status: "complete",
          recordingId,
          message: "Render and export completed",
          publicUrl,
          exportPath,
        });
      } catch (uploadErr: any) {
        console.error("Export upload failed:", uploadErr);
        await db.collection("recordings").doc(recordingId).update({
          status: "render_failed",
          error: uploadErr.message,
        });

        return res.status(500).json({
          error: "Failed to upload rendered video",
          details: uploadErr.message,
        });
      }
    }

    res.json({
      status: "queued",
      recordingId,
      message: "Render job queued",
    });
  } catch (err: any) {
    console.error("render error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// POST /api/editing/create-recording - Create a new recording document when stream starts
router.post("/create-recording", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { roomName, title, viewerCount, peakViewers } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Create new recording document
    const recordingRef = db.collection("recordings").doc();
    const recordingData = {
      id: recordingRef.id,
      userId,
      roomName: roomName || "default-room",
      title,
      status: "ready", // Immediately ready since we can't record the actual stream
      duration: 0,
      viewerCount: viewerCount || 0,
      peakViewers: peakViewers || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      videoUrl: null, // Will be populated if video is uploaded
      thumbnailUrl: null,
      progress: 100,
    };

    await recordingRef.set(recordingData);

    console.log("✅ Recording created:", recordingData);

    res.json({
      ok: true,
      id: recordingRef.id,
      status: "ready",
      message: "Recording created successfully",
      recording: recordingData,
    });
  } catch (err: any) {
    console.error("❌ create-recording error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ============================================================================
// RECORDING START/STOP ENDPOINTS
// ============================================================================

// POST /api/recordings/start - Start a new recording session
router.post("/recordings/start", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { roomName, title } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!roomName || !title) {
      return res.status(400).json({ error: "roomName and title required" });
    }

    // Create recording document
    const recordingRef = db.collection("recordings").doc();
    const recordingData = {
      id: recordingRef.id,
      userId,
      roomName,
      title,
      status: "recording",
      startedAt: new Date(),
      stoppedAt: null,
      duration: 0,
      viewerCount: 0,
      peakViewers: 0,
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
    };

    await recordingRef.set(recordingData);

    console.log("✅ Recording started:", recordingRef.id);

    res.json({
      success: true,
      id: recordingRef.id,
      status: "recording",
    });
  } catch (err: any) {
    console.error("❌ recording start error:", err);
    res.status(500).json({ error: err.message || "Failed to start recording" });
  }
});

// POST /api/recordings/stop - Stop recording and finalize metadata
router.post("/recordings/stop", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { recordingId, duration, viewerCount, peakViewers } = req.body;
    const userId = req.user?.id;

    if (!userId || !recordingId) {
      return res.status(400).json({ error: "Unauthorized or missing recordingId" });
    }

    // Update recording document
    const recordingRef = db.collection("recordings").doc(recordingId);
    
    await recordingRef.update({
      status: "ready",
      stoppedAt: new Date(),
      duration: duration || 0,
      viewerCount: viewerCount || 0,
      peakViewers: peakViewers || 0,
      progress: 100,
    });

    console.log("✅ Recording stopped:", recordingId);

    res.json({
      success: true,
      id: recordingId,
      status: "ready",
      duration: duration,
    });
  } catch (err: any) {
    console.error("❌ recording stop error:", err);
    res.status(500).json({ error: err.message || "Failed to stop recording" });
  }
});

// GET /api/recordings/:id - Get recording by ID
router.get("/recordings/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const recordingDoc = await db.collection("recordings").doc(id).get();

    if (!recordingDoc.exists) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const recording = recordingDoc.data();

    // Verify user owns this recording
    if (recording?.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(recording);
  } catch (err: any) {
    console.error("❌ get recording error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch recording" });
  }
});

export default router;
