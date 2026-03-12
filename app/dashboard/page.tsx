"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TCN_PRICE_USD_CENTS, TCGOLD_PRICE_USD_CENTS } from "@/lib/prices";
import WithdrawalPreflightModal from "@/components/WithdrawalPreflightModal";
import { computeDisplayedQueueDays } from "@/lib/withdrawalQueue";

type Wallet = {
  balance: number;
  tcGoldBalance: number;
};

type Transaction = {
  id: number;
  amount: number;
  type: string;
  status: string;
  description?: string | null;
  adminNote?: string | null; // ✅ ADDED
  createdAt: string;
};

type UserMeta = {
  id: number;
  email: string;
  tier?: string | null;
  lastLoginAt?: string | null;
};

type Profile = {
  fullName?: string | null;
  country?: string | null;
};

type PendingWithdrawal = {
  id: number;
  amountTcn: number;
  asset: string;
  network: string;
  address?: string | null;
  status: string;
  createdAt: string;
  queuedAt?: string | null;
  queueDueAt?: string | null;
  queueLane?: string | null;
  expediteAppliedAt?: string | null;
  holdDeficitTcg?: number | null;
  holdReason?: string | null;
  collateralTierSnapshot?: string | null;
  collateralReserveFloorTcg?: number | null;
  collateralRequiredTcg?: number | null;
  proUpgradeActivatedAt?: string | null;
  proUpgradeRevertDeadlineAt?: string | null;
  lastPayoutRetryAt?: string | null;
  estimatedMinMinutes?: number | null;
  estimatedMaxMinutes?: number | null;
  estimatedLabel?: string | null;
};

type WithdrawalAuditStatus = "PASS" | "FAIL";

type WithdrawalAudit = {
  id: number;
  withdrawalRequestId: number | null;
  amountTcnSnapshot: number;
  tierSnapshot: string;
  reserveFloorTcg: number;
  requiredTcg: number;
  currentTcg: number;
  availableTcg: number;
  deficitTcg: number;
  result: WithdrawalAuditStatus;
  createdAt: string;
};

type AuditBreakdown = {
  tierSnapshot: string;
  reserveFloorTcg: number;
  currentTcg: number;
  availableTcg: number;
  requiredTcg: number;
  deficitTcg: number;
  rulesText: string;
};

type PreflightGateState = "idle" | "running_audit" | "failed" | "passed";

type DashboardAlertStatus =
  | "NEW"
  | "VIEWED"
  | "ACTED"
  | "RESOLVED"
  | "EXPIRED";

type DashboardAlert = {
  id: number;
  title: string;
  message: string;
  severity: "INFO" | "HIGH" | "CRITICAL";
  requiresAction: boolean;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  status: DashboardAlertStatus;
  viewedAt?: string | null;
  actedAt?: string | null;
  resolvedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

const fmtUsdFromCents = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

const formatType = (t: string) => {
  switch (t) {
    case "DEPOSIT":
      return "Deposit";
    case "WITHDRAW":
      return "Withdrawal";
    case "BUY_TCGOLD":
      return "Bought TCGold";
    case "TCG_PURCHASE":
      return "TCGold purchase confirmed";
    case "SELL_TCGOLD":
      return "Sold TCGold";
    case "ADMIN_TCG_CREDIT":
      return "Admin TCGold credit";
    case "WITHDRAW_CRYPTO_REQUEST":
      return "Crypto withdrawal request";
    default:
      return t.replace(/_/g, " ").toLowerCase();
  }
};

const statusChipClasses = (status: string) => {
  switch (status) {
    case "SUCCESS":
      return "bg-emerald-900/60 text-emerald-300";
    case "PENDING":
      return "bg-amber-900/60 text-amber-300";
    case "FAILED":
    case "REJECTED":
      return "bg-rose-900/60 text-rose-300";
    default:
      return "bg-slate-800 text-slate-200";
  }
};

const alertSeverityClasses = (severity: DashboardAlert["severity"]) => {
  switch (severity) {
    case "CRITICAL":
      return "border-rose-700/70 bg-rose-950/40 text-rose-100";
    case "HIGH":
      return "border-amber-700/70 bg-amber-950/40 text-amber-100";
    default:
      return "border-sky-700/70 bg-sky-950/40 text-sky-100";
  }
};

export default function DashboardPage() {
  const router = useRouter();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userMeta, setUserMeta] = useState<UserMeta | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slaDays, setSlaDays] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingWithdrawal, setPendingWithdrawal] =
    useState<PendingWithdrawal | null>(null);
  const [queuedWithdrawal, setQueuedWithdrawal] =
    useState<PendingWithdrawal | null>(null);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [audit, setAudit] = useState<WithdrawalAudit | null>(null);
  const [breakdown, setBreakdown] = useState<AuditBreakdown | null>(null);
  const [auditLogs, setAuditLogs] = useState<WithdrawalAudit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseMessage, setReleaseMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [revertLoading, setRevertLoading] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [revertMessage, setRevertMessage] = useState<string | null>(null);
  const [queueNow, setQueueNow] = useState(Date.now());
  const [queueJumpAppliedById, setQueueJumpAppliedById] = useState<
    Record<number, boolean>
  >({});
  const [gateState, setGateState] = useState<PreflightGateState>("idle");
  const [dashboardAlert, setDashboardAlert] = useState<DashboardAlert | null>(
    null,
  );
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertActionLoading, setAlertActionLoading] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("transportcoin_token")
      : null;

  const dismissalKey = userMeta?.id
    ? `withdrawalPreflightDismissedId:${userMeta.id}`
    : null;

  const getDismissedId = () => {
    if (!dismissalKey || typeof window === "undefined") return null;
    const value = localStorage.getItem(dismissalKey);
    const parsed = Number(value);
    if (!value || !Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const setDismissedId = (withdrawalId: number | null) => {
    if (!dismissalKey || typeof window === "undefined") return;
    if (!withdrawalId) {
      localStorage.removeItem(dismissalKey);
      return;
    }
    localStorage.setItem(dismissalKey, String(withdrawalId));
  };

  const queueJumpKey = userMeta?.id
    ? `withdrawalQueueDisplayJump:${userMeta.id}`
    : null;

  const persistQueueJumpMap = (value: Record<number, boolean>) => {
    if (!queueJumpKey || typeof window === "undefined") return;
    localStorage.setItem(queueJumpKey, JSON.stringify(value));
  };

  // Redirect if not logged in
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem("transportcoin_token");
    if (!t) router.push("/login");
  }, [router]);

  useEffect(() => {
    if (!queueJumpKey || typeof window === "undefined") return;
    const raw = localStorage.getItem(queueJumpKey);
    if (!raw) {
      setQueueJumpAppliedById({});
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      const normalized: Record<number, boolean> = {};
      for (const [key, value] of Object.entries(parsed)) {
        const id = Number(key);
        if (Number.isInteger(id) && id > 0 && value) {
          normalized[id] = true;
        }
      }
      setQueueJumpAppliedById(normalized);
    } catch {
      setQueueJumpAppliedById({});
    }
  }, [queueJumpKey]);

  // Load dashboard data
  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, walletRes, metaRes] = await Promise.all([
          fetch("/api/profile", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/wallet/summary", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/wallet/withdrawals/meta", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const profileData = await profileRes.json();
        const walletData = await walletRes.json();
        const metaData = await metaRes.json();

        if (profileData.error) {
          if (
            profileData.error === "Unauthorized" ||
            profileData.error === "User not found"
          ) {
            localStorage.removeItem("transportcoin_token");
            router.push("/login");
            return;
          }
        } else {
          if (profileData.user) {
            setUserMeta({
              id: profileData.user.id,
              email: profileData.user.email,
              tier: profileData.user.tier,
              lastLoginAt: profileData.user.lastLoginAt,
            });
          }
          if (profileData.profile) {
            setProfile({
              fullName: profileData.profile.fullName,
              country: profileData.profile.country,
            });
          }
        }

        if (walletData.error) {
          console.error(walletData.error);
        } else {
          setWallet(walletData.wallet ?? null);
          setTransactions(walletData.transactions ?? []);
        }

        if (!metaData.error) {
          if (typeof metaData.slaDays === "number") setSlaDays(metaData.slaDays);
          if (typeof metaData.pendingCount === "number")
            setPendingCount(metaData.pendingCount);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, router]);

  const loadPendingWithdrawal = async () => {
    if (!token || !userMeta?.id) return;
    try {
      const res = await fetch("/api/wallet/withdrawals/pending-latest", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        return;
      }
      const nextWithdrawal = data.withdrawal ?? null;
      setPendingWithdrawal(nextWithdrawal);
      if (!nextWithdrawal) {
        setDismissedId(null);
        return;
      }
      const dismissedId = getDismissedId();
      if (dismissedId !== nextWithdrawal.id) {
        setPreflightOpen(true);
      } else {
        setPreflightOpen(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadQueuedWithdrawal = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/wallet/withdrawals/queue-latest", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        return;
      }
      setQueuedWithdrawal(data.withdrawal ?? null);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAuditLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/wallet/withdrawals/audit/logs", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setAuditLogs([]);
        return;
      }
      setAuditLogs(data.logs || []);
    } catch (err) {
      console.error(err);
      setAuditLogs([]);
    }
  };

  const loadDashboardAlert = async () => {
    if (!token) return;
    setAlertLoading(true);
    setAlertError(null);
    try {
      const res = await fetch("/api/dashboard/alerts", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setDashboardAlert(null);
        setAlertError(data.error || "Could not load dashboard alerts.");
        return;
      }

      const nextAlert = (data.alert as DashboardAlert | null) ?? null;
      setDashboardAlert(nextAlert);

      if (nextAlert?.status === "NEW") {
        await fetch("/api/dashboard/alerts", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            alertId: nextAlert.id,
            action: "view",
          }),
        });
      }
    } catch (err) {
      console.error(err);
      setDashboardAlert(null);
      setAlertError("Network error loading dashboard alerts.");
    } finally {
      setAlertLoading(false);
    }
  };

  const updateDashboardAlertStatus = async (
    alertId: number,
    action: "act" | "resolve",
  ) => {
    if (!token) return;
    setAlertActionLoading(true);
    setAlertError(null);
    try {
      const res = await fetch("/api/dashboard/alerts", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alertId,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAlertError(data.error || "Failed to update alert status.");
        return;
      }
      if (action === "resolve") {
        setDashboardAlert(null);
      } else {
        setDashboardAlert((data.alert as DashboardAlert | null) ?? null);
      }
    } catch (err) {
      console.error(err);
      setAlertError("Network error updating alert status.");
    } finally {
      setAlertActionLoading(false);
    }
  };

  const handleAlertAction = async () => {
    if (!dashboardAlert) return;
    await updateDashboardAlertStatus(dashboardAlert.id, "act");
    if (dashboardAlert.ctaHref) {
      router.push(dashboardAlert.ctaHref);
    }
  };

  const runWithdrawalAudit = async () => {
    if (!token) return;
    setGateState("running_audit");
    setAuditLoading(true);
    setAuditError(null);
    setAuditMessage(null);
    setReleaseError(null);
    setReleaseMessage(null);

    try {
      const res = await fetch("/api/wallet/withdrawals/audit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setAudit(null);
        setBreakdown(null);
        setAuditError(data.error || data.message || "Withdrawal audit failed.");
        if (res.status === 404) {
          setPendingWithdrawal(null);
          setGateState("idle");
        } else {
          setGateState("failed");
        }
        return;
      }
      setAudit(data.audit || null);
      setBreakdown(data.breakdown || null);
      setAuditMessage(data.message || null);
      setGateState(data.audit?.result === "PASS" ? "passed" : "failed");
      if (data.withdrawal) {
        setPendingWithdrawal(data.withdrawal);
      }
      await loadAuditLogs();
    } catch (err) {
      console.error(err);
      setAuditError("Network error running withdrawal audit.");
    } finally {
      setAuditLoading(false);
    }
  };

  const releaseWithdrawal = async () => {
    if (!token || !pendingWithdrawal) return;
    if (gateState !== "passed") {
      setReleaseError(
        "Run Withdrawal Audit and ensure the latest result is PASS before releasing.",
      );
      return;
    }
    setReleaseLoading(true);
    setReleaseError(null);
    setReleaseMessage(null);

    try {
      const res = await fetch("/api/wallet/withdrawals/release", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ withdrawalId: pendingWithdrawal.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setBreakdown(data.breakdown || null);
          setReleaseError(data.message || "Release check failed.");
          if (data.withdrawal?.status === "WAITING_QUEUE") {
            setQueuedWithdrawal(data.withdrawal);
            setPreflightOpen(true);
          } else {
            setGateState("failed");
          }
          await loadAuditLogs();
          return;
        }
        setReleaseError(data.error || "Failed to release withdrawal.");
        return;
      }

      setReleaseMessage(data.message || "Withdrawal queued.");
      setToastMessage("Withdrawal queued successfully.");
      setTimeout(() => setToastMessage(null), 4000);
      setQueuedWithdrawal(data.withdrawal || null);
      setPendingWithdrawal(data.withdrawal || null);
      setGateState("passed");
      setPreflightOpen(true);
      await loadQueuedWithdrawal();
      await loadAuditLogs();
    } catch (err) {
      console.error(err);
      setReleaseError("Network error releasing withdrawal.");
    } finally {
      setReleaseLoading(false);
    }
  };

  const upgradeToProLane = async () => {
    if (!token) return;
    setUpgradeLoading(true);
    setUpgradeError(null);
    setUpgradeMessage(null);
    setRevertError(null);
    setRevertMessage(null);
    try {
      const res = await fetch("/api/wallet/withdrawals/upgrade", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setUpgradeError(data.error || "Failed to upgrade queue lane.");
        return;
      }
      setUpgradeMessage(data.message || "Upgraded to PRO.");
      setQueuedWithdrawal(data.withdrawal || null);
      setUserMeta((prev) => (prev ? { ...prev, tier: data.tier || "PRO" } : prev));
      await loadQueuedWithdrawal();
    } catch (err) {
      console.error(err);
      setUpgradeError("Network error upgrading queue lane.");
    } finally {
      setUpgradeLoading(false);
    }
  };

  const revertToBasicLane = async () => {
    if (!token) return;
    setRevertLoading(true);
    setRevertError(null);
    setRevertMessage(null);
    setUpgradeError(null);
    try {
      const res = await fetch("/api/wallet/withdrawals/upgrade/revert", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setRevertError(data.error || "Failed to revert to BASIC.");
        return;
      }
      setRevertMessage(data.message || "Returned to BASIC lane.");
      setQueuedWithdrawal(data.withdrawal || null);
      setUserMeta((prev) =>
        prev ? { ...prev, tier: data.tier || "BASIC" } : prev
      );
      await loadQueuedWithdrawal();
      await loadAuditLogs();
    } catch (err) {
      console.error(err);
      setRevertError("Network error reverting to BASIC lane.");
    } finally {
      setRevertLoading(false);
    }
  };

  useEffect(() => {
    loadPendingWithdrawal();
    loadQueuedWithdrawal();
    loadAuditLogs();
    loadDashboardAlert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userMeta?.id]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      loadPendingWithdrawal();
      loadQueuedWithdrawal();
      loadDashboardAlert();
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userMeta?.id]);

  useEffect(() => {
    if (!pendingWithdrawal && !queuedWithdrawal) {
      setPreflightOpen(false);
    }
  }, [pendingWithdrawal, queuedWithdrawal]);

  const tcnBalance = wallet?.balance ?? 0;
  const tcgBalance = wallet?.tcGoldBalance ?? 0;

  const latestAuditForPending = useMemo(() => {
    if (!pendingWithdrawal) return null;
    return (
      auditLogs.find(
        (log) => log.withdrawalRequestId === pendingWithdrawal.id,
      ) || null
    );
  }, [auditLogs, pendingWithdrawal]);

  useEffect(() => {
    if (!pendingWithdrawal) {
      setGateState("idle");
      return;
    }
    if (auditLoading) {
      setGateState("running_audit");
      return;
    }
    if (!latestAuditForPending) {
      setGateState("idle");
      return;
    }
    setGateState(latestAuditForPending.result === "PASS" ? "passed" : "failed");
  }, [auditLoading, latestAuditForPending, pendingWithdrawal]);

  const allowRelease = gateState === "passed";

  useEffect(() => {
    const interval = setInterval(() => {
      setQueueNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const rawQueueDaysRemaining = useMemo(() => {
    if (!queuedWithdrawal?.queueDueAt) return null;
    if (queuedWithdrawal.queueLane === "PRO") return null;
    const dueAt = new Date(queuedWithdrawal.queueDueAt).getTime();
    return Math.max(0, Math.ceil((dueAt - queueNow) / (24 * 60 * 60 * 1000)));
  }, [queuedWithdrawal?.queueDueAt, queuedWithdrawal?.queueLane, queueNow]);

  useEffect(() => {
    if (!queuedWithdrawal?.id || queuedWithdrawal.queueLane === "PRO") return;
    if (rawQueueDaysRemaining !== 14) return;
    if (queueJumpAppliedById[queuedWithdrawal.id]) return;
    const next = { ...queueJumpAppliedById, [queuedWithdrawal.id]: true };
    setQueueJumpAppliedById(next);
    persistQueueJumpMap(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedWithdrawal?.id, queuedWithdrawal?.queueLane, rawQueueDaysRemaining]);

  const displayedQueueDays = useMemo(() => {
    if (!queuedWithdrawal?.queueDueAt) return null;
    if (queuedWithdrawal.queueLane === "PRO") return null;
    return computeDisplayedQueueDays({
      queueDueAt: queuedWithdrawal.queueDueAt,
      now: new Date(queueNow),
      jumpApplied: Boolean(queueJumpAppliedById[queuedWithdrawal.id]),
    });
  }, [queuedWithdrawal, queueJumpAppliedById, queueNow]);

  // ✅ Unified pricing (cents)
  const tcnValueUsdCents = tcnBalance * TCN_PRICE_USD_CENTS;
  const tcgValueUsdCents = tcgBalance * TCGOLD_PRICE_USD_CENTS;
  const totalValueUsdCents = tcnValueUsdCents + tcgValueUsdCents;

  const greetingName = useMemo(() => {
    if (profile?.fullName && profile.fullName.trim().length > 0) {
      return profile.fullName.split(" ")[0];
    }
    if (userMeta?.email) {
      return userMeta.email.split("@")[0];
    }
    return "Transporter";
  }, [profile, userMeta]);

  const recentTransactions = useMemo(
    () => (transactions || []).slice(0, 8),
    [transactions],
  );

  const alertExpiresLabel = useMemo(() => {
    if (!dashboardAlert?.expiresAt) return null;
    return new Date(dashboardAlert.expiresAt).toLocaleString();
  }, [dashboardAlert?.expiresAt]);

  if (loading && !wallet && !userMeta) {
    return (
      <main className="p-6 text-sm text-slate-400">
        Loading your Transportcoin dashboard…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black p-6 text-slate-50">
      {/* TOP BAR */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
            Transportcoin Overview
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            Welcome back, <span className="text-gold">{greetingName}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Your transport-focused trading wallet, TCGold status, and activity
            in one place.
          </p>
        </div>

        <div className="flex flex-col items-start gap-1 text-xs text-slate-400 md:items-end">
          <span>
            Tier:{" "}
            <span className="rounded-full border border-slate-700/80 bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-gold">
              {userMeta?.tier ?? "BASIC"}
            </span>
          </span>
          <span>
            Country:{" "}
            <span className="font-medium text-slate-100">
              {profile?.country ?? "Not set"}
            </span>
          </span>
          <span>
            Last login:{" "}
            <span className="font-medium text-slate-100">
              {formatDateTime(userMeta?.lastLoginAt)}
            </span>
          </span>
        </div>
      </div>

      {dashboardAlert && (
        <section
          className={`mb-5 rounded-2xl border px-4 py-3 text-xs ${alertSeverityClasses(
            dashboardAlert.severity,
          )}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.18em] opacity-90">
                Action required
              </p>
              <h2 className="mt-1 text-sm font-semibold">{dashboardAlert.title}</h2>
              <p className="mt-1 text-[12px] opacity-90">{dashboardAlert.message}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-80">
                <span>Status: {dashboardAlert.status.toLowerCase()}</span>
                {alertExpiresLabel && <span>Deadline: {alertExpiresLabel}</span>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {dashboardAlert.ctaHref && (
                <button
                  onClick={handleAlertAction}
                  disabled={alertActionLoading}
                  className="rounded-full border border-current px-3 py-2 text-[11px] font-semibold hover:bg-black/20 disabled:opacity-60"
                >
                  {alertActionLoading
                    ? "Processing..."
                    : dashboardAlert.ctaLabel || "Take action"}
                </button>
              )}
              <button
                onClick={() =>
                  updateDashboardAlertStatus(dashboardAlert.id, "resolve")
                }
                disabled={alertActionLoading}
                className="rounded-full border border-current px-3 py-2 text-[11px] hover:bg-black/20 disabled:opacity-60"
              >
                Dismiss
              </button>
            </div>
          </div>
          {alertError && <p className="mt-2 text-[11px]">{alertError}</p>}
        </section>
      )}

      {alertLoading && !dashboardAlert && (
        <p className="mb-4 text-[11px] text-slate-500">Checking alerts...</p>
      )}

      {pendingWithdrawal?.status === "PENDING" && !preflightOpen && (
        <div className="mb-5 rounded-2xl border border-amber-800/60 bg-amber-950/40 px-4 py-3 text-xs text-amber-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-200">
                Withdrawal pre-flight check
              </p>
              <p className="mt-1 text-[11px] text-amber-100">
                You have a pending withdrawal. Resume the pre-flight check to
                review and release it for payout.
              </p>
            </div>
            <button
              onClick={() => setPreflightOpen(true)}
              className="rounded-full border border-amber-400 px-3 py-2 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/10"
            >
              Resume Withdrawal
            </button>
          </div>
        </div>
      )}

      {/* HERO + STATUS STRIP */}
      <section className="grid gap-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)]">
        {/* Portfolio hero */}
        <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/10 via-black to-black p-5 shadow-glow">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
            Portfolio value
          </p>
          <p className="mt-2 text-3xl font-semibold text-gold">
            {fmtUsdFromCents(totalValueUsdCents)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Includes your TCN balance and TCGold holdings at indicative internal
            rates.
          </p>

          <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-black/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                TCN · Transportcoin
              </p>
              <p className="mt-1 text-lg font-semibold">
                {tcnBalance}{" "}
                <span className="text-xs font-normal text-slate-400">TCN</span>
              </p>
              <p className="text-[13px] text-gold">
                {fmtUsdFromCents(tcnValueUsdCents)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Utility balance for transport activities and on/off-ramp
                requests.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-black/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                TCG · TCGold
              </p>
              <p className="mt-1 text-lg font-semibold">
                {tcgBalance}{" "}
                <span className="text-xs font-normal text-slate-400">TCG</span>
              </p>
              <p className="text-[13px] text-gold">
                {fmtUsdFromCents(tcgValueUsdCents)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Governance-style token for deeper participation and withdrawal
                privileges.
              </p>
            </div>
          </div>
        </div>

        {/* Queue + quick actions */}
        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Withdrawal queue status
              </h2>
              <span className="rounded-full border border-slate-700 bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                Ops signal
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <p>
                Target confirmation:{" "}
                <span className="font-semibold text-slate-50">
                  {slaDays
                    ? `within ${slaDays} day${slaDays > 1 ? "s" : ""}`
                    : "—"}
                </span>
              </p>
              <p>
                Network queue:{" "}
                <span className="font-semibold text-slate-50">
                  {pendingCount ?? "—"} pending request
                  {pendingCount && pendingCount !== 1 ? "s" : ""}
                </span>
              </p>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              This reflects the current manual operations load for crypto
              withdrawals across Transportcoin. Use it as a guide when planning
              large transfers.
            </p>

            <div className="mt-3 rounded-xl border border-slate-800 bg-black/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Your waiting queue
              </p>
              {queuedWithdrawal ? (
                <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                  <p>
                    Withdrawal #{queuedWithdrawal.id} ·{" "}
                    {queuedWithdrawal.amountTcn.toLocaleString()} TCN
                  </p>
                  <p>
                    Status:{" "}
                    <span className="font-semibold text-slate-100">
                      {queuedWithdrawal.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </p>
                  <p>
                    Lane:{" "}
                    <span className="font-semibold text-slate-100">
                      {queuedWithdrawal.queueLane || "BASIC"}
                    </span>
                  </p>
                  <p>
                    ETA:{" "}
                    <span className="font-semibold text-slate-100">
                      {queuedWithdrawal.queueLane === "PRO"
                        ? queuedWithdrawal.estimatedLabel || "5 to 30 minutes"
                        : `${displayedQueueDays ?? "—"} day${displayedQueueDays === 1 ? "" : "s"}`}
                    </span>
                  </p>
                  <p>
                    Real due:{" "}
                    <span className="font-semibold text-slate-100">
                      {queuedWithdrawal.queueDueAt
                        ? new Date(queuedWithdrawal.queueDueAt).toLocaleString()
                        : "—"}
                    </span>
                  </p>
                  {queuedWithdrawal.status === "ON_HOLD_COLLATERAL" && (
                    <>
                      <p className="text-amber-300">
                        Collateral deficit:{" "}
                        {queuedWithdrawal.holdDeficitTcg?.toLocaleString() || 0} TCG
                      </p>
                      <p className="text-amber-200/90">
                        {queuedWithdrawal.holdReason ||
                          "Top up deficit to auto-release checks every 10 minutes."}
                      </p>
                    </>
                  )}
                  {userMeta?.tier !== "PRO" && (
                    <div className="mt-2 rounded-xl border border-gold/30 bg-black/30 px-3 py-2">
                      <p className="text-[10px] text-slate-300">
                        Cost: 1000 TCGold · PRO ETA: 5 to 30 minutes
                      </p>
                      <button
                        onClick={upgradeToProLane}
                        disabled={upgradeLoading}
                        className="mt-2 rounded-full border border-gold px-3 py-1.5 text-[10px] font-semibold text-gold hover:bg-gold/10 disabled:opacity-60"
                      >
                        {upgradeLoading
                          ? "Upgrading..."
                          : "Jump Queue · Upgrade to PRO"}
                      </button>
                    </div>
                  )}
                  {upgradeError && (
                    <p className="text-rose-300">{upgradeError}</p>
                  )}
                  {upgradeMessage && !upgradeError && (
                    <p className="text-emerald-300">{upgradeMessage}</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-slate-500">
                  No queued withdrawals yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300">
            <h3 className="text-sm font-semibold text-slate-100">
              Quick navigation
            </h3>
            <p className="mt-1 text-[11px] text-slate-500">
              Jump straight into the key areas of your Transportcoin account.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <button
                onClick={() => router.push("/dashboard/wallets")}
                className="rounded-xl border border-gold/40 bg-black/70 px-3 py-2 text-[11px] font-semibold text-gold hover:bg-gold/10"
              >
                Wallets
              </button>
              <button
                onClick={() => router.push("/dashboard/trading")}
                className="rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-[11px] font-semibold hover:border-slate-600"
              >
                Trading
              </button>
              <button
                onClick={() => router.push("/dashboard/settings")}
                className="rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-[11px] font-semibold hover:border-slate-600"
              >
                Profile & Settings
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* LOWER SECTION: ACTIVITY + SNAPSHOTS */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)]">
        {/* Activity feed */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Recent activity
              </h2>
              <p className="text-[11px] text-slate-500">
                The latest movements across your TCN and TCGold balances.
              </p>
            </div>
          </div>

          {recentTransactions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No activity yet. Once you start depositing, trading, or requesting
              withdrawals, they’ll appear here.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <ul className="space-y-2 text-xs">
                {recentTransactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-start justify-between rounded-2xl border border-slate-800/80 bg-black/60 px-3 py-2"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-slate-100">
                        {formatType(tx.type)}
                      </p>

                      {tx.description && (
                        <p className="text-[11px] text-slate-400">
                          {tx.description}
                        </p>
                      )}

                      {/* ✅ ADMIN NOTE (visible to user) */}
                      {tx.adminNote && tx.adminNote.trim().length > 0 && (
                        <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 px-2 py-2 text-[11px] text-amber-200">
                          <span className="font-semibold text-amber-300">
                            Admin note:
                          </span>{" "}
                          {tx.adminNote}
                        </div>
                      )}

                      <p className="text-[11px] text-slate-500">
                        {formatDateTime(tx.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusChipClasses(
                          tx.status,
                        )}`}
                      >
                        {tx.status}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-100">
                        {tx.amount}{" "}
                        <span className="text-slate-400">TCN units</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Small snapshots */}
        <div className="space-y-4 text-xs">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <h3 className="text-sm font-semibold text-slate-100">
              Account snapshot
            </h3>
            <div className="mt-3 space-y-2 text-[11px] text-slate-300">
              <p>
                Email:{" "}
                <span className="font-medium text-slate-100">
                  {userMeta?.email ?? "—"}
                </span>
              </p>
              <p>
                Tier:{" "}
                <span className="font-medium text-gold">
                  {userMeta?.tier ?? "BASIC"}
                </span>
              </p>
              <p>
                Country:{" "}
                <span className="font-medium text-slate-100">
                  {profile?.country ?? "Not set"}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <h3 className="text-sm font-semibold text-slate-100">
              Transport-first vision
            </h3>
            <p className="mt-2 text-[11px] text-slate-400">
              Transportcoin is built as a trading layer focused on mobility and
              logistics. Your TCN balance can underpin fuel, fleet, and
              route-based payments, while TCGold tracks your deeper stake in the
              network.
            </p>
            <button
              onClick={() => router.push("/dashboard/trading")}
              className="mt-3 rounded-xl border border-gold/50 bg-black/70 px-3 py-2 text-[11px] font-semibold text-gold hover:bg-gold/10"
            >
              Explore trading view
            </button>
          </div>
        </div>
      </section>

      <WithdrawalPreflightModal
        isOpen={preflightOpen}
        onClose={() => {
          setPreflightOpen(false);
          if (pendingWithdrawal?.status === "PENDING") {
            setDismissedId(pendingWithdrawal.id);
          }
        }}
        withdrawal={pendingWithdrawal || queuedWithdrawal}
        audit={audit}
        breakdown={breakdown}
        logs={auditLogs}
        auditLoading={auditLoading}
        releaseLoading={releaseLoading}
        gateState={gateState}
        allowRelease={allowRelease}
        onRunAudit={runWithdrawalAudit}
        onRelease={releaseWithdrawal}
        onUpgradeToPro={upgradeToProLane}
        onRevertToBasic={revertToBasicLane}
        upgradeLoading={upgradeLoading}
        upgradeError={upgradeError}
        revertLoading={revertLoading}
        revertError={revertError}
        revertMessage={revertMessage}
        message={auditMessage}
        error={auditError}
        releaseMessage={releaseMessage}
        releaseError={releaseError}
        displayedQueueDays={displayedQueueDays}
      />

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-40 rounded-2xl border border-emerald-700/60 bg-emerald-950/70 px-4 py-3 text-xs text-emerald-200 shadow-xl">
          {toastMessage}
        </div>
      )}
    </main>
  );
}
