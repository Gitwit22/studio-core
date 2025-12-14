// server/routes/multistream.ts
import express from "express";

const router = express.Router();

// Placeholder multistream routes - to be implemented
router.post("/:roomName/start-multistream", async (req, res) => {
  res.status(501).json({ error: "Multistream feature not yet implemented" });
});

router.post("/:roomName/stop-multistream", async (req, res) => {
  res.status(501).json({ error: "Multistream feature not yet implemented" });
});

export default router;