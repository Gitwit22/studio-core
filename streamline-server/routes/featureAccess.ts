// featureAccess.ts
import { firestore } from "../firebaseAdmin";

export type FeatureAccessResult = {
  allowed: boolean;
  reason?: string;
  limits?: {
    maxDestinations?: number;
  };
};

export async function canAccessFeature(
  userId: string,
  feature: "multistream" | "recording" | "editing"
): Promise<FeatureAccessResult> {
  // Load user
  const userSnap = await firestore.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    return { allowed: false, reason: "User not found" };
  }


  const user = userSnap.data()!;
  const planId = user.planId || "free";

  // Strict billing enforcement for paid plans
  const paidPlans = ["starter", "pro"];
  if (paidPlans.includes(planId)) {
    const billingStatus = user.billingStatus || "";
    const billingActive = user.billingActive;
    const subscriptionId = user.billing?.subscriptionId || user.billing?.stripeSubscriptionId;
    if (
      ["past_due", "unpaid", "incomplete", "canceled"].includes(billingStatus) ||
      billingActive === false ||
      !subscriptionId
    ) {
      return {
        allowed: false,
        reason: "Billing issue: access to paid features is blocked. Please resolve your payment in billing settings.",
      };
    }
  }

  // Load plan
  const planSnap = await firestore.collection("plans").doc(planId).get();
  if (!planSnap.exists) {
    return { allowed: false, reason: "Invalid plan" };
  }

  const plan = planSnap.data() as any;

  // Internal plan, unlimited plan, or gates disabled: always allow
  if (plan.internalOnly === true || plan.gatesEnabled === false || planId === "internal_unlimited") {
    return { allowed: true };
  }

  // =========================
  // MULTISTREAM
  // =========================
  if (feature === "multistream") {
    if (!plan.multistreamEnabled) {
      return {
        allowed: false,
        reason: "Multistreaming is not available on your plan",
      };
    }

    return {
      allowed: true,
      limits: {
        maxDestinations: plan.limits?.rtmpDestinationsMax,
      },
    };
  }

  // =========================
  // RECORDING
  // =========================
  if (feature === "recording") {
    if (!plan.features?.recording) {
      return {
        allowed: false,
        reason: "Recording is not available on your plan",
      };
    }

    return {
      allowed: true,
    };
  }

  // =========================
  // EDITING
  // =========================
  if (feature === "editing") {
    if (!plan.editing?.access) {
      return {
        allowed: false,
        reason: "Editing is not available on your plan",
      };
    }

    return {
      allowed: true,
    };
  }

  return { allowed: false, reason: "Unknown feature" };
}
