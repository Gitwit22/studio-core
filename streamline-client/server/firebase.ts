import admin from "firebase-admin";

let serviceAccount: admin.ServiceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  // Production: decode from environment variable
  const decoded = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
    "base64"
  ).toString("utf-8");
  serviceAccount = JSON.parse(decoded);
} else {
  // Local development: use file
  serviceAccount = require("./firebaseServiceAccount.json");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const db = admin.firestore();
export const firestore = admin.firestore();
export const auth = admin.auth();