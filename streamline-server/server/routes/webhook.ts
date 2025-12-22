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
  console.log("=".repeat(80));
  console.log("🔔 LiveKit webhook received at", new Date().toISOString());
  console.log("=".repeat(80));
  
  try {
    const secret = mustGetEnv("LIVEKIT_WEBHOOK_SECRET");
    const receiver = new WebhookReceiver(secret, secret);

    const authHeader = (req.headers["authorization"] as string) || "";
    const rawBody = (req as any).body as Buffer;

    console.log("🔐 Auth header present:", !!authHeader);
    console.log("📦 Raw body size:", rawBody.length, "bytes");

    console.log("🔍 Parsing webhook event...");
    
    const event = await receiver.receive(rawBody.toString("utf8"), authHeader);

    console.log("📋 Webhook event type:", event.event);
    console.log("📦 Full event data:", JSON.stringify(event, null, 2));

    if (event.event === "egress_ended") {
      const recordingId = event.egressInfo?.egressId;
      
      console.log("\n" + "=".repeat(80));
      console.log("🎬 EGRESS_ENDED EVENT DETAILS");
      console.log("=".repeat(80));
      console.log("📝 Recording ID:", recordingId);
      console.log("📦 Egress Info:", JSON.stringify(event.egressInfo, null, 2));
      
      if (!recordingId) {
        console.error("❌ CRITICAL: Missing egressId in egress_ended event");
        console.error("   This should never happen - check LiveKit configuration");
        return res.status(400).json({ error: "Missing egressId" });
      }

      // filepath is what YOU set in EncodedFileOutput.filepath
      const objectKey =
        (event.egressInfo as any)?.file?.filepath ||
        (event.egressInfo as any)?.fileResults?.[0]?.filepath ||
        null;

      console.log("🔑 Object key from webhook:", objectKey);

      if (!objectKey) {
        console.error("❌ WARNING: No object key found in egress event");
        console.error("   File may not have been uploaded to R2");
        console.error("   Check LiveKit egress logs for upload errors");
      }

      // one-time token for secure download
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      console.log("🎫 Generated one-time download token");
      console.log("   Raw token (save this for testing):", rawToken);
      console.log("   Hashed token (stored in DB):", hashedToken.substring(0, 20) + "...");

      // Update Firestore with final status
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

      console.log("✅ Recording marked as READY in Firestore");
      console.log("   Recording ID:", recordingId);
      console.log("   Object Key:", objectKey);
      console.log("   Status: READY");
      
      // Log download URL format (for testing)
      console.log("\n📥 Download URL format:");
      console.log(`   GET /api/recordings/${recordingId}/download?token=${rawToken}`);
      
      console.log("=".repeat(80) + "\n");
    } else {
      console.log("ℹ️  Ignoring event type:", event.event);
      console.log("   (Only egress_ended events are processed)");
    }

    return res.status(200).json({ ok: true });
    
  } catch (err: any) {
    console.error("=".repeat(80));
    console.error("❌ WEBHOOK ERROR");
    console.error("=".repeat(80));
    console.error("Error type:", err.name);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    console.error("=".repeat(80) + "\n");
    
    return res.status(400).json({ 
      error: "Webhook processing error", 
      details: err?.message || String(err)
    });
  }
});

export default router;