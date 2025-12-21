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
  console.log("🔔 LiveKit webhook received");
  
  try {
    const secret = mustGetEnv("LIVEKIT_WEBHOOK_SECRET");
    const receiver = new WebhookReceiver(secret, secret);

    const authHeader = (req.headers["authorization"] as string) || "";
    const rawBody = (req as any).body as Buffer;

    console.log("📝 Parsing webhook event...");
    
    const event = await receiver.receive(rawBody.toString("utf8"), authHeader);

    console.log("📦 Webhook event type:", event.event);

    if (event.event === "egress_ended") {
      const recordingId = event.egressInfo?.egressId;
      
      console.log("🎬 Egress ended event:", {
        recordingId,
        hasEgressInfo: !!event.egressInfo
      });
      
      if (!recordingId) {
        console.error("❌ Missing egressId in egress_ended event");
        return res.status(400).json({ error: "Missing egressId" });
      }

      // filepath is what YOU set in EncodedFileOutput.filepath
      const objectKey =
        (event.egressInfo as any)?.file?.filepath ||
        (event.egressInfo as any)?.fileResults?.[0]?.filepath ||
        null;

      console.log("📁 Object key from webhook:", objectKey);

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

      console.log("✅ Recording marked as READY:", recordingId);
      
      // DEV ONLY (don't ship logging rawToken in production)
      console.log(
        `[webhook] egress_ended recordingId=${recordingId} objectKey=${objectKey} oneTimeToken=${rawToken}`
      );
    }

    return res.status(200).json({ ok: true });
    
  } catch (err: any) {
    console.error("❌ LiveKit webhook error:", err);
    return res.status(400).json({ 
      error: "Webhook processing error", 
      details: err?.message || String(err)
    });
  }
});

export default router;