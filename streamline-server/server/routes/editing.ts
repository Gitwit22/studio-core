import { Router } from "express";

const router = Router();

router.post("/upload", (req, res) => {
  res.json({ ok: true });
});

router.get("/list", (req, res) => {
  res.json([]);
});

router.post("/save", (req, res) => {
  res.json({ ok: true });
});

router.post("/render", (req, res) => {
  res.json({ status: "queued" });
});

export default router;
