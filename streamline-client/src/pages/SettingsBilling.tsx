// ============================================================================
// STREAMLINE SETTINGS BILLING PAGE
// Place in: src/pages/SettingsBilling.tsx
// ============================================================================

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

// ============================================================================
// TYPES
// ============================================================================

interface BillingInfo {
  provider?: string;
  customerId?: string;
  subscriptionId?: string;
  priceId?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: number;
  updatedAt?: number;
}

interface UserData {
  id: string;
  email?: string;
  displayName?: string;
  planId: string;
  pendingPlan?: string | null;
  billingStatus?: string;
  billingActive?: boolean;
  billing?: BillingInfo;
}

interface PlanDefinition {
  id: string;
  name: string;
  price: number;
  description?: string;
  limits: {
    monthlyMinutesIncluded: number;
    maxGuests: number;
    rtmpDestinationsMax: number;
    maxSessionMinutes: number;
    maxHoursPerMonth: number;
  };
  features: {
    recording: boolean;
    rtmp: boolean;
    multistream?: boolean;
  };
  editing?: {
    access: boolean;
    maxProjects: number;
    maxStorageGB: number;
  };
}

interface UsageData {
  streamingMinutes: { used: number; limit: number };
  rtmpDestinations: { used: number; limit: number };
  storage: { used: number; limit: number };
  projects: { used: number; limit: number };
}

// ============================================================================
// DEFAULT PLAN DEFINITIONS (fallback if API fails)
// ============================================================================

const DEFAULT_PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Get started with streaming",
    limits: {
      monthlyMinutesIncluded: 60,
      maxGuests: 1,
      rtmpDestinationsMax: 1,
      maxSessionMinutes: 30,
      maxHoursPerMonth: 1,
    },
    features: { recording: false, rtmp: false },
    editing: { access: false, maxProjects: 0, maxStorageGB: 0 },
  },
  {
    id: "starter",
    name: "Starter",
    price: 15,
    description: "For growing creators",
    limits: {
      monthlyMinutesIncluded: 300,
      maxGuests: 2,
      rtmpDestinationsMax: 2,
      maxSessionMinutes: 60,
      maxHoursPerMonth: 5,
    },
    features: { recording: true, rtmp: true, multistream: true },
    editing: { access: true, maxProjects: 5, maxStorageGB: 10 },
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    description: "For professional streamers",
    limits: {
      monthlyMinutesIncluded: 1200,
      maxGuests: 10,
      rtmpDestinationsMax: 5,
      maxSessionMinutes: 180,
      maxHoursPerMonth: 20,
    },
    features: { recording: true, rtmp: true, multistream: true },
    editing: { access: true, maxProjects: 50, maxStorageGB: 100 },
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDaysUntil(timestamp: number | undefined): number {
  if (!timestamp) return 0;
  const now = Date.now();
  const diff = timestamp - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getStatusBadge(status: string | undefined, cancelAtPeriodEnd?: boolean): { text: string; color: string; bg: string; icon: string } {
  if (cancelAtPeriodEnd && (status === "active" || status === "trialing")) {
    return { text: "Canceling", color: "#f59e0b", bg: "rgba(245,158,11,0.15)", icon: "⏳" };
  }
  switch (status) {
    case "active":
      return { text: "Active", color: "#22c55e", bg: "rgba(34,197,94,0.15)", icon: "✓" };
    case "trialing":
      return { text: "Trial", color: "#3b82f6", bg: "rgba(59,130,246,0.15)", icon: "🧪" };
    case "past_due":
      return { text: "Past Due", color: "#ef4444", bg: "rgba(239,68,68,0.15)", icon: "⚠️" };
    case "unpaid":
      return { text: "Unpaid", color: "#ef4444", bg: "rgba(239,68,68,0.15)", icon: "⛔" };
    case "canceled":
      return { text: "Canceled", color: "#6b7280", bg: "rgba(107,114,128,0.15)", icon: "✕" };
    default:
      return { text: "Free", color: "#6b7280", bg: "rgba(107,114,128,0.15)", icon: "○" };
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettingsBilling() {
  const nav = useNavigate();

  const [user, setUser] = useState<UserData | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[]>(DEFAULT_PLANS);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadUser(), loadPlans(), loadUsage()]);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load user");
    const data = await res.json();
    setUser(data);
  };

  const loadPlans = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/plans`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.plans?.length) setPlans(data.plans);
      }
    } catch {
      // Use defaults
    }
  };

  const loadUsage = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/usage/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch {
      // Mock usage for demo
      setUsage({
        streamingMinutes: { used: 45, limit: 60 },
        rtmpDestinations: { used: 1, limit: 1 },
        storage: { used: 0, limit: 0 },
        projects: { used: 0, limit: 0 },
      });
    }
  };

  const startCheckout = async (plan: "starter" | "pro") => {
    setActionLoading(plan);
    try {
      const res = await fetch(`${API_BASE}/api/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setActionLoading(null);
    }
  };

  const openPortal = async () => {
    setActionLoading("portal");
    try {
      const res = await fetch(`${API_BASE}/api/billing/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Portal failed");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setActionLoading(null);
    }
  };

  // Derived state
  const currentPlan = plans.find(p => p.id === user?.planId) || plans[0];
  const status = user?.billingStatus;
  const isBlocked = status === "past_due" || status === "unpaid";
  const isPaidValid = status === "active" || status === "trialing";
  const isProcessing = !!user?.pendingPlan && user?.planId === "free";
  const statusBadge = getStatusBadge(status, user?.billing?.cancelAtPeriodEnd);
  const daysLeft = getDaysUntil(user?.billing?.currentPeriodEnd);

  if (loading) {
    return (
      <div style={S.container}>
        <div style={S.loadingScreen}>
          <div style={S.spinner} />
          <p>Loading billing information...</p>
        </div>
        <style>{CSS}</style>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.orb1} />
      <div style={S.orb2} />

      <div style={S.content}>
        {/* Header */}
        <div style={S.header}>
          <h1 style={S.title}>💳 Billing & Plans</h1>
          <button onClick={loadAllData} style={S.refreshBtn} disabled={loading}>
            🔄 Refresh
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={S.errorBanner}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} style={S.errorClose}>×</button>
          </div>
        )}

        {/* Back to Join Button */}
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: 24 }}>
          <button
            onClick={() => nav("/join")}
            style={{
              background: "#18181b",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "8px 18px",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
              marginRight: 12,
            }}
          >
            ← Back to Join
          </button>
        </div>

        {/* ================================================================ */}
        {/* SECTION 1: PAYMENT WARNING (if blocked) */}
        {/* ================================================================ */}
        {isBlocked && (
          <div style={S.warningCard}>
            <div style={S.warningIcon}>⚠️</div>
            <div style={S.warningContent}>
              <h3 style={S.warningTitle}>Payment Issue — Features Blocked</h3>
              <p style={S.warningText}>
                Your payment failed or is past due. Paid features like recording, multistream, 
                and downloads are temporarily disabled until payment is resolved.
              </p>
              <div style={S.warningActions}>
                <button onClick={openPortal} style={S.fixPaymentBtn} disabled={!!actionLoading}>
                  {actionLoading === "portal" ? "⏳ Loading..." : "💳 Fix Payment"}
                </button>
                <a href="mailto:support@streamline.app" style={S.supportLink}>
                  Contact Support
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* SECTION 2: YOUR PLAN (current plan card) */}
        {/* ================================================================ */}
        <div style={{ ...S.card, opacity: isBlocked ? 0.6 : 1 }}>
          <div style={S.cardHeader}>
            <h2 style={S.cardTitle}>Your Plan</h2>
            {isProcessing && (
              <span style={S.processingBadge}>
                ⏳ Processing upgrade to {user?.pendingPlan}...
              </span>
            )}
          </div>

          <div style={S.planDisplay}>
            <div style={S.planInfo}>
              <div style={S.planNameRow}>
                <span style={S.planName}>{currentPlan.name}</span>
                <span style={{ ...S.statusBadge, color: statusBadge.color, background: statusBadge.bg }}>
                  {statusBadge.icon} {statusBadge.text}
                </span>
              </div>
              <div style={S.planPrice}>
                <span style={S.priceAmount}>${currentPlan.price}</span>
                <span style={S.pricePeriod}>/month</span>
              </div>
              {currentPlan.description && (
                <p style={S.planDescription}>{currentPlan.description}</p>
              )}
            </div>

            <div style={S.billingDetails}>
              {status === "trialing" && (
                <div style={S.detailRow}>
                  <span style={S.detailLabel}>Trial ends</span>
                  <span style={S.detailValue}>
                    {formatDate(user?.billing?.currentPeriodEnd)}
                    <span style={S.daysLeft}>({daysLeft} days left)</span>
                  </span>
                </div>
              )}
              {status === "active" && !user?.billing?.cancelAtPeriodEnd && (
                <div style={S.detailRow}>
                  <span style={S.detailLabel}>Next billing</span>
                  <span style={S.detailValue}>{formatDate(user?.billing?.currentPeriodEnd)}</span>
                </div>
              )}
              {user?.billing?.cancelAtPeriodEnd && (
                <div style={S.detailRow}>
                  <span style={S.detailLabel}>Access ends</span>
                  <span style={{ ...S.detailValue, color: "#f59e0b" }}>
                    {formatDate(user?.billing?.currentPeriodEnd)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Primary Actions */}
          <div style={S.actionButtons}>
            {/* Free user, no billing */}
            {user?.planId === "free" && !status && !isProcessing && (
              <>
                <button
                  onClick={() => startCheckout("starter")}
                  style={S.primaryBtn}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "starter" ? "⏳ Loading..." : "🚀 Start Starter Trial"}
                </button>
                <button
                  onClick={() => startCheckout("pro")}
                  style={S.secondaryBtn}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "pro" ? "⏳ Loading..." : "⚡ Upgrade to Pro"}
                </button>
              </>
            )}

            {/* Trialing */}
            {status === "trialing" && (
              <>
                <button onClick={openPortal} style={S.primaryBtn} disabled={!!actionLoading}>
                  {actionLoading === "portal" ? "⏳ Loading..." : "⚙️ Manage Billing"}
                </button>
                {user?.planId === "starter" && (
                  <button
                    onClick={() => startCheckout("pro")}
                    style={S.secondaryBtn}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === "pro" ? "⏳ Loading..." : "⚡ Upgrade to Pro"}
                  </button>
                )}
              </>
            )}

            {/* Active */}
            {status === "active" && (
              <>
                <button onClick={openPortal} style={S.primaryBtn} disabled={!!actionLoading}>
                  {actionLoading === "portal" ? "⏳ Loading..." : "⚙️ Manage Billing"}
                </button>
                {user?.planId === "starter" && (
                  <button
                    onClick={() => startCheckout("pro")}
                    style={S.secondaryBtn}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === "pro" ? "⏳ Loading..." : "⚡ Upgrade to Pro"}
                  </button>
                )}
              </>
            )}

            {/* Canceled but still has access */}
            {status === "canceled" && (
              <>
                <button
                  onClick={() => startCheckout(user?.planId === "pro" ? "pro" : "starter")}
                  style={S.primaryBtn}
                  disabled={!!actionLoading}
                >
                  {actionLoading ? "⏳ Loading..." : "🔄 Resubscribe"}
                </button>
                <button onClick={openPortal} style={S.secondaryBtn} disabled={!!actionLoading}>
                  Manage Billing
                </button>
              </>
            )}

            {/* Processing */}
            {isProcessing && (
              <button onClick={loadAllData} style={S.secondaryBtn}>
                🔄 Refresh Status
              </button>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 3: USAGE THIS MONTH */}
        {/* ================================================================ */}
        {usage && (
          <div style={{ ...S.card, opacity: isBlocked ? 0.6 : 1 }}>
            <div style={S.cardHeader}>
              <h2 style={S.cardTitle}>📊 Usage This Month</h2>
              {user?.billing?.currentPeriodEnd && (
                <span style={S.resetDate}>
                  Resets {formatDate(user.billing.currentPeriodEnd)}
                </span>
              )}
            </div>

            <div style={S.usageGrid}>
              <UsageBar
                label="Streaming Minutes"
                used={usage.streamingMinutes.used}
                limit={usage.streamingMinutes.limit || currentPlan.limits.monthlyMinutesIncluded}
                unit="min"
              />
              <UsageBar
                label="RTMP Destinations"
                used={usage.rtmpDestinations.used}
                limit={usage.rtmpDestinations.limit || currentPlan.limits.rtmpDestinationsMax}
                unit=""
              />
              {(isPaidValid || usage.storage.limit > 0) && (
                <UsageBar
                  label="Storage"
                  used={usage.storage.used}
                  limit={usage.storage.limit || currentPlan.editing?.maxStorageGB || 0}
                  unit="GB"
                />
              )}
              {(isPaidValid || usage.projects.limit > 0) && (
                <UsageBar
                  label="Projects"
                  used={usage.projects.used}
                  limit={usage.projects.limit || currentPlan.editing?.maxProjects || 0}
                  unit=""
                />
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* SECTION 4: PLAN COMPARISON */}
        {/* ================================================================ */}
        <div style={S.card}>
          <h2 style={S.cardTitle}>📋 Compare Plans</h2>
          
          <div style={S.plansGrid}>
            {plans.map((plan) => {
              const isCurrent = plan.id === user?.planId;
              const isUpgrade = plans.indexOf(plan) > plans.findIndex(p => p.id === user?.planId);
              const color = plan.id === "free" ? "#6b7280" : plan.id === "starter" ? "#3b82f6" : "#8b5cf6";

              return (
                <div
                  key={plan.id}
                  style={{
                    ...S.planCard,
                    borderColor: isCurrent ? color : "rgba(63,63,70,0.5)",
                    boxShadow: isCurrent ? `0 0 20px ${color}30` : "none",
                  }}
                >
                  {isCurrent && <div style={{ ...S.currentBadge, background: color }}>Current</div>}
                  
                  <div style={S.planCardHeader}>
                    <h3 style={{ ...S.planCardName, color }}>{plan.name}</h3>
                    <div style={S.planCardPrice}>
                      <span style={S.planCardAmount}>${plan.price}</span>
                      <span style={S.planCardPeriod}>/mo</span>
                    </div>
                  </div>

                  <ul style={S.featureList}>
                    <FeatureRow label="Monthly minutes" value={plan.limits.monthlyMinutesIncluded} />
                    <FeatureRow label="Max guests" value={plan.limits.maxGuests} />
                    <FeatureRow label="RTMP destinations" value={plan.limits.rtmpDestinationsMax} />
                    <FeatureRow label="Recording" value={plan.features.recording} />
                    <FeatureRow label="Multistream" value={plan.features.multistream} />
                    <FeatureRow label="Editing suite" value={plan.editing?.access} />
                    {plan.editing?.access && (
                      <>
                        <FeatureRow label="Projects" value={plan.editing.maxProjects} />
                        <FeatureRow label="Storage" value={`${plan.editing.maxStorageGB}GB`} />
                      </>
                    )}
                  </ul>

                  <div style={S.planCardAction}>
                    {isCurrent ? (
                      <span style={S.currentLabel}>✓ Current Plan</span>
                    ) : isUpgrade ? (
                      <button
                        onClick={() => startCheckout(plan.id as "starter" | "pro")}
                        style={{ ...S.planUpgradeBtn, background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
                        disabled={!!actionLoading || isBlocked}
                      >
                        {actionLoading === plan.id ? "⏳..." : plan.id === "starter" ? "Start Trial" : "Upgrade"}
                      </button>
                    ) : (
                      <span style={S.downgradeLabel}>Downgrade in portal</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 5: WHAT'S LOCKED (if blocked or free) */}
        {/* ================================================================ */}
        {(isBlocked || user?.planId === "free") && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>🔒 Locked Features</h2>
            <p style={S.lockedSubtitle}>
              {isBlocked
                ? "These features are blocked due to payment issues:"
                : "Upgrade to unlock these features:"}
            </p>
            
            <div style={S.lockedGrid}>
              {!currentPlan.features.recording && (
                <LockedFeature
                  icon="🎬"
                  title="Recording"
                  description="Record your streams and download them"
                  requiredPlan="Starter"
                />
              )}
              {!currentPlan.features.multistream && (
                <LockedFeature
                  icon="📡"
                  title="Multistream"
                  description="Stream to YouTube, Twitch, and Facebook simultaneously"
                  requiredPlan="Starter"
                />
              )}
              {!currentPlan.editing?.access && (
                <LockedFeature
                  icon="✂️"
                  title="Editing Suite"
                  description="Edit your recordings with our built-in editor"
                  requiredPlan="Starter"
                />
              )}
              {currentPlan.limits.maxGuests < 10 && (
                <LockedFeature
                  icon="👥"
                  title="More Guests"
                  description="Invite up to 10 guests to your streams"
                  requiredPlan="Pro"
                />
              )}
            </div>

            {!isBlocked && user?.planId === "free" && (
              <div style={S.lockedCta}>
                <button onClick={() => startCheckout("starter")} style={S.primaryBtn} disabled={!!actionLoading}>
                  🚀 Start Free Trial to Unlock
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{CSS}</style>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function UsageBar({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isWarning = percent > 80;
  const isDanger = percent > 95;

  return (
    <div style={S.usageItem}>
      <div style={S.usageHeader}>
        <span style={S.usageLabel}>{label}</span>
        <span style={S.usageValue}>
          {used}{unit} / {limit}{unit}
        </span>
      </div>
      <div style={S.usageTrack}>
        <div
          style={{
            ...S.usageFill,
            width: `${percent}%`,
            background: isDanger
              ? "linear-gradient(90deg, #ef4444, #dc2626)"
              : isWarning
                ? "linear-gradient(90deg, #f59e0b, #d97706)"
                : "linear-gradient(90deg, #22c55e, #16a34a)",
          }}
        />
      </div>
    </div>
  );
}

function FeatureRow({ label, value }: { label: string; value: boolean | number | string | undefined }) {
  const displayValue = typeof value === "boolean" 
    ? (value ? "✓" : "—") 
    : value?.toString() || "—";
  const isEnabled = value === true || (typeof value === "number" && value > 0) || (typeof value === "string" && value !== "—");

  return (
    <li style={{ ...S.featureItem, opacity: isEnabled ? 1 : 0.5 }}>
      <span style={S.featureLabel}>{label}</span>
      <span style={{ ...S.featureValue, color: isEnabled ? "#22c55e" : "#6b7280" }}>
        {displayValue}
      </span>
    </li>
  );
}

function LockedFeature({ icon, title, description, requiredPlan }: { icon: string; title: string; description: string; requiredPlan: string }) {
  return (
    <div style={S.lockedItem}>
      <div style={S.lockedIcon}>{icon}</div>
      <div>
        <div style={S.lockedTitle}>{title}</div>
        <div style={S.lockedDesc}>{description}</div>
        <div style={S.lockedRequired}>Requires {requiredPlan}+</div>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const S: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    fontFamily: "system-ui, -apple-system, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  orb1: {
    position: "fixed",
    top: "5%",
    left: "5%",
    width: 400,
    height: 400,
    background: "rgba(220,38,38,0.1)",
    borderRadius: "50%",
    filter: "blur(100px)",
    pointerEvents: "none",
  },
  orb2: {
    position: "fixed",
    bottom: "10%",
    right: "10%",
    width: 500,
    height: 500,
    background: "rgba(59,130,246,0.08)",
    borderRadius: "50%",
    filter: "blur(120px)",
    pointerEvents: "none",
  },
  content: {
    position: "relative",
    zIndex: 10,
    maxWidth: 900,
    margin: "0 auto",
    padding: "32px 24px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    background: "linear-gradient(to right, #fff, #fecaca)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  refreshBtn: {
    padding: "10px 20px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 10,
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
  },
  loadingScreen: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    gap: 16,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid rgba(220,38,38,0.3)",
    borderTopColor: "#dc2626",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  errorBanner: {
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.4)",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#fca5a5",
  },
  errorClose: {
    background: "transparent",
    border: "none",
    color: "#fca5a5",
    fontSize: 20,
    cursor: "pointer",
  },
  warningCard: {
    background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1))",
    border: "2px solid rgba(239,68,68,0.5)",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    display: "flex",
    gap: 20,
    alignItems: "flex-start",
  },
  warningIcon: {
    fontSize: 40,
    flexShrink: 0,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    margin: "0 0 8px",
    fontSize: 20,
    fontWeight: 700,
    color: "#fca5a5",
  },
  warningText: {
    margin: "0 0 16px",
    color: "#fecaca",
    lineHeight: 1.5,
  },
  warningActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  fixPaymentBtn: {
    padding: "12px 24px",
    background: "linear-gradient(135deg, #ef4444, #dc2626)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  supportLink: {
    color: "#fca5a5",
    textDecoration: "underline",
    fontSize: 14,
  },
  card: {
    background: "rgba(15,15,15,0.7)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(63,63,70,0.5)",
    borderRadius: 20,
    padding: 28,
    marginBottom: 24,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  cardTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
  },
  processingBadge: {
    fontSize: 13,
    padding: "6px 12px",
    background: "rgba(245,158,11,0.2)",
    color: "#fbbf24",
    borderRadius: 20,
  },
  planDisplay: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 24,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  planInfo: {},
  planNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  planName: {
    fontSize: 32,
    fontWeight: 700,
  },
  statusBadge: {
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
  },
  planPrice: {
    marginBottom: 8,
  },
  priceAmount: {
    fontSize: 24,
    fontWeight: 700,
    color: "#ef4444",
  },
  pricePeriod: {
    fontSize: 14,
    color: "#9ca3af",
  },
  planDescription: {
    margin: 0,
    color: "#9ca3af",
    fontSize: 14,
  },
  billingDetails: {
    textAlign: "right",
  },
  detailRow: {
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginRight: 8,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 500,
  },
  daysLeft: {
    marginLeft: 8,
    color: "#3b82f6",
    fontSize: 13,
  },
  actionButtons: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  primaryBtn: {
    padding: "14px 28px",
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    border: "none",
    borderRadius: 12,
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(220,38,38,0.3)",
  },
  secondaryBtn: {
    padding: "14px 28px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 12,
    color: "#fff",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
  },
  resetDate: {
    fontSize: 13,
    color: "#6b7280",
  },
  usageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 20,
  },
  usageItem: {},
  usageHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  usageLabel: {
    fontSize: 14,
    color: "#d1d5db",
  },
  usageValue: {
    fontSize: 13,
    color: "#9ca3af",
  },
  usageTrack: {
    height: 8,
    background: "rgba(63,63,70,0.5)",
    borderRadius: 4,
    overflow: "hidden",
  },
  usageFill: {
    height: "100%",
    borderRadius: 4,
    transition: "width 0.5s",
  },
  plansGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 20,
    marginTop: 20,
  },
  planCard: {
    background: "rgba(0,0,0,0.3)",
    border: "2px solid",
    borderRadius: 16,
    padding: 20,
    position: "relative",
    overflow: "hidden",
  },
  currentBadge: {
    position: "absolute",
    top: 12,
    right: -30,
    padding: "4px 40px",
    fontSize: 11,
    fontWeight: 700,
    color: "#fff",
    transform: "rotate(45deg)",
    textTransform: "uppercase",
  },
  planCardHeader: {
    marginBottom: 16,
  },
  planCardName: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
  },
  planCardPrice: {
    marginTop: 4,
  },
  planCardAmount: {
    fontSize: 28,
    fontWeight: 700,
  },
  planCardPeriod: {
    fontSize: 14,
    color: "#9ca3af",
  },
  featureList: {
    margin: "0 0 16px",
    padding: 0,
    listStyle: "none",
  },
  featureItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid rgba(63,63,70,0.3)",
    fontSize: 13,
  },
  featureLabel: {
    color: "#d1d5db",
  },
  featureValue: {
    fontWeight: 600,
  },
  planCardAction: {
    marginTop: 16,
    textAlign: "center",
  },
  currentLabel: {
    color: "#22c55e",
    fontWeight: 600,
  },
  planUpgradeBtn: {
    width: "100%",
    padding: "12px",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  downgradeLabel: {
    fontSize: 13,
    color: "#6b7280",
  },
  lockedSubtitle: {
    margin: "0 0 20px",
    color: "#9ca3af",
  },
  lockedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 16,
  },
  lockedItem: {
    display: "flex",
    gap: 16,
    padding: 16,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(63,63,70,0.3)",
    borderRadius: 12,
  },
  lockedIcon: {
    fontSize: 28,
    flexShrink: 0,
  },
  lockedTitle: {
    fontWeight: 600,
    marginBottom: 4,
  },
  lockedDesc: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 4,
  },
  lockedRequired: {
    fontSize: 12,
    color: "#ef4444",
    fontWeight: 500,
  },
  lockedCta: {
    marginTop: 24,
    textAlign: "center",
  },
};

const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  button:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  button:disabled { opacity: 0.6; cursor: not-allowed; }
`;
