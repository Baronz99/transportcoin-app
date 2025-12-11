"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

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
  createdAt: string;
};

type UserMeta = {
  email: string;
  tier?: string | null;
  lastLoginAt?: string | null;
};

type Profile = {
  fullName?: string | null;
  country?: string | null;
};

// Same pricing logic we used elsewhere
const TCN_PRICE_USD = 0.01;
const TCGOLD_PRICE_USD = 2.5;

const fmtUsd = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);

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
    case "SELL_TCGOLD":
      return "Sold TCGold";
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

export default function DashboardPage() {
  const router = useRouter();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userMeta, setUserMeta] = useState<UserMeta | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slaDays, setSlaDays] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("transportcoin_token")
      : null;

  // Redirect if not logged in
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem("transportcoin_token");
    if (!t) router.push("/login");
  }, [router]);

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
          if (typeof metaData.slaDays === "number") {
            setSlaDays(metaData.slaDays);
          }
          if (typeof metaData.pendingCount === "number") {
            setPendingCount(metaData.pendingCount);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, router]);

  const tcnBalance = wallet?.balance ?? 0;
  const tcgBalance = wallet?.tcGoldBalance ?? 0;
  const tcnValueUsd = tcnBalance * TCN_PRICE_USD;
  const tcgValueUsd = tcgBalance * TCGOLD_PRICE_USD;
  const totalValueUsd = tcnValueUsd + tcgValueUsd;

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

      {/* HERO + STATUS STRIP */}
      <section className="grid gap-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)]">
        {/* Portfolio hero */}
        <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/10 via-black to-black p-5 shadow-glow">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
            Portfolio value
          </p>
          <p className="mt-2 text-3xl font-semibold text-gold">
            {fmtUsd(totalValueUsd)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Includes your TCN balance and TCGold holdings at indicative
            internal rates.
          </p>

          <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-black/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                TCN · Transportcoin
              </p>
              <p className="mt-1 text-lg font-semibold">
                {tcnBalance}{" "}
                <span className="text-xs font-normal text-slate-400">
                  TCN
                </span>
              </p>
              <p className="text-[13px] text-gold">{fmtUsd(tcnValueUsd)}</p>
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
                <span className="text-xs font-normal text-slate-400">
                  TCG
                </span>
              </p>
              <p className="text-[13px] text-gold">{fmtUsd(tcgValueUsd)}</p>
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
              No activity yet. Once you start depositing, trading, or
              requesting withdrawals, they’ll appear here.
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
    </main>
  );
}
