import { Router } from "express";
import { PLANS } from "../usagePlans";

const router = Router();

router.get("/", (_req, res) => {
  return res.json({ plans: PLANS });
});

export default router;
