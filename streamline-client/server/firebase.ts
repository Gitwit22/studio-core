// server/firebase.ts
import admin from "firebase-admin";
// Import JSON file properly
const serviceAccount = require("./firebaseServiceAccount.json");

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export const db = admin.firestore();
export const auth = admin.auth();

export default admin;