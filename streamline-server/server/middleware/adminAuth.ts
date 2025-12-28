import { Request, Response, NextFunction } from "express";
import { firestore } from "../firebaseAdmin";

/**
 * Admin authentication middleware
 * Checks if the requesting user has admin privileges
 * 
 * Usage:
 *   router.get('/admin/users', requireAdmin, async (req, res) => { ... })
 */

// Extend Express Request type to include admin info
declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        uid: string;
        email: string;
        isAdmin: boolean;
      };
    }
  }
}

/**
 * Check if user is an admin
 * Admin status is stored in Firestore under /admins/{uid}
 */
async function isAdmin(uid: string): Promise<boolean> {
  try {
    const adminDoc = await firestore.collection("admins").doc(uid).get();
    return adminDoc.exists && adminDoc.data()?.isAdmin === true;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Middleware to require admin authentication
 * Expects JWT token in Authorization header or userId in request body
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract user ID from JWT token or request body
    const authHeader = req.headers.authorization;
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      // In production, decode JWT token here
      // For now, we'll use a simple approach
      const token = authHeader.substring(7);
      
      // TODO: Decode JWT and extract userId
      // For MVP, we can pass userId directly in body or query
      userId = req.body.adminUserId || req.query.adminUserId as string;
    } else {
      // Fallback: get from body or query
      userId = req.body.adminUserId || req.query.adminUserId as string;
    }

    if (!userId) {
      res.status(401).json({ 
        error: "Unauthorized", 
        message: "Admin authentication required" 
      });
      return;
    }

    // Check if user is admin
    const adminStatus = await isAdmin(userId);

    if (!adminStatus) {
      console.warn(`Non-admin user ${userId} attempted to access admin endpoint`);
      res.status(403).json({ 
        error: "Forbidden", 
        message: "Admin privileges required" 
      });
      return;
    }

    // Get admin user details
    const userDoc = await firestore.collection("users").doc(userId).get();
    const userData = userDoc.data();

    // Attach admin user to request
    req.adminUser = {
      uid: userId,
      email: userData?.email || "unknown",
      isAdmin: true,
    };

    console.log(`Admin ${req.adminUser.email} accessing: ${req.method} ${req.path}`);

    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: "Failed to verify admin status" 
    });
  }
}

/**
 * Helper function to grant admin privileges to a user
 * This should only be called by system administrators
 */
export async function grantAdminPrivileges(
  userId: string,
  grantedBy: string
): Promise<void> {
  await firestore.collection("admins").doc(userId).set({
    isAdmin: true,
    grantedBy,
    grantedAt: new Date(),
  });

  console.log(`Admin privileges granted to ${userId} by ${grantedBy}`);
}

/**
 * Helper function to revoke admin privileges
 */
export async function revokeAdminPrivileges(
  userId: string,
  revokedBy: string
): Promise<void> {
  await firestore.collection("admins").doc(userId).delete();

  console.log(`Admin privileges revoked from ${userId} by ${revokedBy}`);
}

/**
 * Middleware to log admin actions
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  details: Record<string, any>
): Promise<void> {
  try {
    await firestore.collection("adminLogs").add({
      adminId,
      action,
      details,
      timestamp: new Date(),
      ip: details.ip || "unknown",
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
    // Don't throw - logging failure shouldn't break the operation
  }
}