import webhookRouter from "./routes/webhook";
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { RoomServiceClient } from "livekit-server-sdk";
import multistreamRoutes from "./routes/multistream";
import roomTokenRoute from "./routes/roomToken";
import recordingsRouter from "./routes/recordings";
import usageRoutes from "./routes/usageRoutes";
import admin from "firebase-admin";
import adminRoutes from './routes/admin';
import adminStatusRouter from "./routes/adminStatus";

import { firestore as db } from "./firebaseAdmin";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

import { uploadVideo } from "./lib/storageClient";

dotenv.config();

const PORT = process.env.PORT || 5137;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const app = express();


app.use(cors({
  origin: [
    'https://streamline-platform-test.onrender.com',
    'https://streamline-platform.onrender.com',  // Add production too
    'http://localhost:5173',  // Local development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(
  "/api/livekit/webhook", 
  express.raw({ type: "application/json" }), 
  webhookRouter
);



app.use("/api/livekit/webhook", express.raw({ type: "application/json" }), webhookRouter);



app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use("/api/admin", adminStatusRouter);


// Recordings API - This handles GET /:id and POST /start, /stop
app.use("/api/recordings", recordingsRouter);

// Health check
app.get("/", (_req, res) => res.send("API up"));
app.use("/api/usage", usageRoutes); // gives /api/usage/summary

// =============================================================================
// API ROUTES - Order matters! More specific routes first
// =============================================================================

// Token route used by the frontend
app.use("/api/roomToken", roomTokenRoute);

// Multistream routes (YouTube/FB/Twitch)
app.use("/api/rooms", multistreamRoutes);

// Storage test route
app.get("/api/storage/test", async (req, res) => {
  try {
    const testContent = `StreamLine Storage Test - ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent);
    const testPath = `test/${Date.now()}-test.txt`;

    const publicUrl = await uploadVideo(testBuffer, testPath, "text/plain");

    res.json({
      success: true,
      message: "✅ R2 storage is working!",
      publicUrl,
      testPath,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ Storage test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Storage test failed",
    });
  }
});

// =============================================================================
// Admin Controls (Host/Mod Only)
// =============================================================================
const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

// Remove/kick a participant
app.post("/api/admin/remove", async (req, res) => {
  try {
    const { room, identity } = req.body;
    await roomService.removeParticipant(room, identity);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("remove error", e);
    res.status(500).json({ error: e.message || "remove_error" });
  }
});

// =============================================================================
// AUTH ENDPOINTS
// =============================================================================

// Helper function to generate month key (YYYY-MM)
function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Helper function to calculate next reset date based on signup date
function calculateNextResetDate(createdAt: Date): Date {
  const now = new Date();
  const signupDay = createdAt.getDate();
  
  // Next reset is on the same day next month
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, signupDay);
  
  // If we've already passed this month's reset day, use next month
  if (now.getDate() >= signupDay) {
    return new Date(now.getFullYear(), now.getMonth() + 2, signupDay);
  }
  
  return nextMonth;
}

// Signup
app.post("/api/auth/signup", async (req, res) => {
  try {
    const {
      email,
      password,
      displayName,
      timeZone,
      skipOnboarding,
      defaultResolution,
      defaultDestinations,
      defaultPrivacy,
    } = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
      timeZone?: string;
      skipOnboarding?: boolean;
      defaultResolution?: string;
      defaultDestinations?: { youtube?: boolean; facebook?: boolean, twitch?: boolean };
      defaultPrivacy?: string;
    };

    console.log("🔐 Signup request:", { email, displayName, timeZone });

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    const existingSnap = await db
      .collection("users")
      .where("email", "==", email.trim().toLowerCase())
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return res.status(409).json({ error: "email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    const monthKey = getCurrentMonthKey();

    // =============================================================================
    // CREATE USER DOCUMENT WITH COMPLETE STRUCTURE
    // =============================================================================

    // Build userData (DO NOT store passwordHash)
const userData: any = {
  email: email.trim().toLowerCase(),
  displayName: displayName?.trim() || "",
  timeZone: timeZone || "America/Chicago",

  // Plan assignment
  planId: "free",
  plan: "free", // optional legacy fallback
  planUpdatedAt: now,

  // Social connections
  youtubeConnected: false,
  facebookConnected: false,
  twitchConnected: false,

  // Timestamps
  createdAt: now,
  updatedAt: now,

  // Onboarding
  onboardingCompleted: !skipOnboarding,

  // Billing configuration
  billing: {
    anniversaryDay: now.getDate(),
    nextResetAt: calculateNextResetDate(now),

    // ✅ overages defaults (keep here)
    overagesEnabled: false,
    billingEnabled: false,
    overageRatePerMin: 0,
  },

  // Usage metadata
  usageMeta: {
    activeMonthKey: monthKey,
    lastResetAt: now,
    ytdMinutes: 0,
  },

  admin: { isAdmin: false },

  preferences: skipOnboarding
    ? {}
    : {
        defaultResolution: defaultResolution || "720p",
        defaultDestinations: {
          youtube: defaultDestinations?.youtube ?? false,
          facebook: defaultDestinations?.facebook ?? false,
          twitch: defaultDestinations?.twitch ?? false,
        },
        defaultPrivacy: defaultPrivacy || "public",
      },
};

// Legacy fields (optional)
if (!skipOnboarding) {
  userData.defaultResolution = userData.preferences.defaultResolution;
  userData.defaultDestinations = userData.preferences.defaultDestinations;
  if (defaultPrivacy) userData.defaultPrivacy = defaultPrivacy;
}

// 1) Create Firebase Auth user (this generates UID)
const userRecord = await admin.auth().createUser({
  email: userData.email,
  password, // must be in scope
  displayName: userData.displayName,
});

const uid = userRecord.uid;

// 2) Create Firestore user doc at users/{uid}
const userRef = db.collection("users").doc(uid);

await userRef.set({
  ...userData,
  id: uid,  // optional
  uid: uid, // optional but helpful

  // ✅ optional mirror for older code that checks root
  overagesEnabled: userData.billing.overagesEnabled,
});

console.log("✅ User document created:", uid);


    // =============================================================================
    // INITIALIZE MONTHLY USAGE DOCUMENT
    // =============================================================================

    const usageData = {
      uid: userRef.id,
      monthKey,
      periodStart: now,
      periodEnd: null, // Will be set when month ends
      
      totals: {
        streamMinutes: 0,
        participantMinutes: 0,
        transcodeMinutes: 0,
        overageMinutes: 0,
      },
      
      lastSession: null,
      
      source: "server", // Mark as server-written for security
      updatedAt: now,
    };

    await db.collection("usageMonthly").doc(`${userRef.id}_${monthKey}`).set(usageData);
    console.log("✅ Monthly usage document initialized");

    // =============================================================================
    // RETURN SUCCESS RESPONSE
    // =============================================================================

    const user = {
      id: userRef.id,
      uid: userRef.id, // Include both for compatibility
      email: userData.email,
      displayName: userData.displayName,
      planId: userData.planId,
      plan: userData.plan,
      timeZone: userData.timeZone,
      onboardingCompleted: userData.onboardingCompleted,
      defaultResolution: userData.defaultResolution || null,
      defaultDestinations: userData.defaultDestinations || null,
      defaultPrivacy: userData.defaultPrivacy || null,
      youtubeConnected: userData.youtubeConnected,
      facebookConnected: userData.facebookConnected,
      createdAt: userData.createdAt.toISOString ? userData.createdAt.toISOString() : userData.createdAt,
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });

    console.log("✅ Signup successful for:", email);

    return res.json({ user, token });
  } catch (err) {
    console.error("❌ Signup error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const snap = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(401).json({ error: "invalid email or password" });
    }

    const doc = snap.docs[0];
    const data = doc.data() as any;

    const ok = await bcrypt.compare(password, data.passwordHash || "");
    if (!ok) {
      return res.status(401).json({ error: "invalid email or password" });
    }

    const user = {
      id: doc.id,
      email: data.email,
      displayName: data.displayName || "",
      plan: data.plan || "free",
      timeZone: data.timeZone || null,
      onboardingCompleted: data.onboardingCompleted ?? false,
      defaultResolution: data.defaultResolution || null,
      defaultDestinations: data.defaultDestinations || null,
      defaultPrivacy: data.defaultPrivacy || null,
      youtubeConnected: data.youtubeConnected || false,
      facebookConnected: data.facebookConnected || false,
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });

    return res.json({ user, token });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

// =============================================================================
// USAGE TRACKING
// =============================================================================

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/usage/summary", async (req, res) => {
  try {
    const uid = req.query.uid as string;
    if (!uid) return res.status(400).json({ error: "uid required" });

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "user not found" });
    }

    const userData = userSnap.data() || {};
    const usage = (userData.usage || {}) as any;

    return res.json({
      hoursStreamedToday: usage.hoursStreamedToday || 0,
      hoursStreamedThisMonth: usage.hoursStreamedThisMonth || 0,
      ytdHours: usage.ytdHours || 0,
      guestCountToday: usage.guestCountToday || 0,
      periodStart: usage.periodStart ? usage.periodStart.toDate() : null,
      resetDate: usage.resetDate ? usage.resetDate.toDate() : null,
    });
  } catch (err) {
    console.error("usage summary error", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

app.post("/api/usage/streamEnded", async (req, res) => {
  try {
    const { uid, minutes, guestCount } = req.body as {
      uid?: string;
      minutes?: number;
      guestCount?: number;
    };

    if (!uid) {
      return res.status(400).json({ error: "uid required" });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "user not found" });
    }

    const userData = userSnap.data() || {};
    const usage = (userData.usage || {}) as any;
    const now = new Date();

    const durationMinutes = Math.max(1, minutes || 0);
    const durationHours = durationMinutes / 60;

    // Handle monthly reset
    const resetDate: Date | null =
      usage.resetDate && usage.resetDate.toDate
        ? usage.resetDate.toDate()
        : null;

    if (resetDate && resetDate < now) {
      const nextReset = new Date();
      nextReset.setMonth(nextReset.getMonth() + 1);

      usage.hoursStreamedThisMonth = 0;
      usage.periodStart = now;
      usage.resetDate = nextReset;

      await userRef.update({
        "usage.hoursStreamedThisMonth": 0,
        "usage.periodStart": now,
        "usage.resetDate": nextReset,
      });
    }

    const hoursStreamedToday =
      (usage.hoursStreamedToday || 0) + durationHours;
    const hoursStreamedThisMonth =
      (usage.hoursStreamedThisMonth || 0) + durationHours;
    const ytdHours = (usage.ytdHours || 0) + durationHours;
    const guestCountToday = (usage.guestCountToday || 0) + (guestCount || 0);

    await userRef.update({
      "usage.hoursStreamedToday": hoursStreamedToday,
      "usage.hoursStreamedThisMonth": hoursStreamedThisMonth,
      "usage.ytdHours": ytdHours,
      "usage.guestCountToday": guestCountToday,
      "usage.lastUsageUpdate": now,
    });

    return res.json({
      ok: true,
      durationHours,
      hoursStreamedThisMonth,
      ytdHours,
    });
  } catch (err) {
    console.error("streamEnded error", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// =============================================================================
// SERVE FRONTEND - Must be LAST (catch-all route)
// =============================================================================

app.use((_req, res) => {
  res.json({ 
    service: "StreamLine Backend API",
    status: "running",
    endpoints: ["/api/auth", "/api/recordings", "/api/rooms"]
  });
});


app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});