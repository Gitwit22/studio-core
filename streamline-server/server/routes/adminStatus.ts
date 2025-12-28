// server/routes/adminStatus.ts
import { Router } from "express";
import { firestore } from "../firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";


const router = Router();

router.get("/status", requireAuth, async (req, res) => {
const uid = (req as any).user.uid;

  const snap = await firestore.collection("admins").doc(uid).get();

  res.json({ isAdmin: snap.exists });
});

export default router;
