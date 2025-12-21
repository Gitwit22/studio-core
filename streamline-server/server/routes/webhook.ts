import express from "express";
import crypto from "crypto";
import { WebhookReceiver } from "livekit-server-sdk";
import { firestore } from "../firebaseAdmin";

const router = express.Router();

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// POST /api/livekit/webhook
// IMPORTANT: mount this route with express.raw({ type: "application/json" })
router.post("/", async (req, res) => {
  try {
    const secret = mustGetEnv("LIVEKIT_WEBHOOK_SECRET");
const receiver = new WebhookReceiver(secret, secret);

    const authHeader = (req.headers["authorization"] as string) || "";
    const rawBody = (req as any).body as Buffer;

const event = await receiver.receive(rawBody.toString("utf8"), authHeader);

    if (event.event === "egress_ended") {
      const recordingId = event.egressInfo?.egressId;
      if (!recordingId) {
        return res.status(400).json({ error: "Missing egressId" });
      }

      // filepath is what YOU set in EncodedFileOutput.filepath
const objectKey =
  (event.egressInfo as any)?.file?.filepath ||
  (event.egressInfo as any)?.fileResults?.[0]?.filepath ||
  null;

      // one-time token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      await firestore
        .collection("recordings")
        .doc(recordingId)
        .set(
          {
            objectKey,
            oneTimeToken: hashedToken,
            status: "READY",
            updatedAt: new Date(),
            endedAt: new Date(),
          },
          { merge: true }
        );

      // DEV ONLY (don’t ship logging rawToken)
      console.log(
        `[webhook] egress_ended recordingId=${recordingId} objectKey=${objectKey} oneTimeToken=${rawToken}`
      );
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("LiveKit webhook error:", err);
    return res.status(400).json({ error: "Webhook processing error", details: err?.message });
  }
});

export default router;
