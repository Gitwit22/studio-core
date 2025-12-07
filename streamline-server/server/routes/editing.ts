import { Router, Request, Response } from "express";
import { firestore as db } from "../firebaseAdmin";
import jwt from "jsonwebtoken";
import { uploadVideo, getSignedDownloadUrl } from "../lib/storageClient";
import { checkStorageLimit, updateStorageUsage } from "../usageHelper";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// Middleware to verify JWT and extract user info
const authenticateToken = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: decoded.id, planId: decoded.plan };
    next();
  } catch (err) {
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

// POST /api/editing/upload - For uploading new clips (future use)
router.post("/upload", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { title, description, fileBuffer, fileSizeBytes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // ✅ PROMPT #3: Check storage limits before upload
    if (fileSizeBytes) {
      await checkStorageLimit(userId, fileSizeBytes);
    }

    // Upload file to R2
    if (fileBuffer) {
      const buffer = Buffer.from(fileBuffer);
      const path = `uploads/${userId}/${Date.now()}-${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
      
      const publicUrl = await uploadVideo(buffer, path, "video/mp4");
      
      // Update storage usage
      await updateStorageUsage(userId, buffer.byteLength);

      res.json({
        ok: true,
        message: "File uploaded successfully",
        publicUrl,
        storagePath: path,
      });
    } else {
      res.json({ ok: true, message: "Upload endpoint ready" });
    }
  } catch (err: any) {
    console.error("upload error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// GET /api/editing/list - Get all recordings for the authenticated user
router.get("/list", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const recordingsSnap = await db
      .collection("recordings")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const recordings = recordingsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

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

export default router;
