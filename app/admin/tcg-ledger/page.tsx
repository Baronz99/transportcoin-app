// app/admin/tcg-ledger/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PurchaseRow = {
  id: number;
  userEmail: string;
  tcgAmount: number;
  usdValueCents: number;
  btcAddress: string;
  btcTxId?: string | null;
  status: string;
  createdAt: string;
};

type PlatformConfigDto = {
  withdrawalDelayDays: number;
  btcDepositAddress: string;
};

const formatUsd = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function TcGoldLedgerPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] =
    useState<"PENDING" | "CONFIRMED" | "REJECTED">("PENDING");
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);

  const [config, setConfig] = useState<PlatformConfigDto | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("transportcoin_token")
      : null;

  useEffect(() => {
    if (!token) {
      router.push("/login");
    }
  }, [token, router]);

  const fetchConfig = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(data.error || "Failed to load config");
        return;
      }
      setConfig({
        withdrawalDelayDays: data.config.withdrawalDelayDays,
        btcDepositAddress: data.config.btcDepositAddress || "",
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPurchases = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/tcg-purchases?status=${statusFilter}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load TCGold purchases.");
        return;
      }
      setPurchases(data.purchases || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load TCGold purchases.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [token]);

  useEffect(() => {
    fetchPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter]);

  const saveConfig = async () => {
    if (!token || !config) return;
    setConfigSaving(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          withdrawalDelayDays: config.withdrawalDelayDays,
          btcDepositAddress: config.btcDepositAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to save config.");
        return;
      }
      setConfig({
        withdrawalDelayDays: data.config.withdrawalDelayDays,
        btcDepositAddress: data.config.btcDepositAddress || "",
      });
      alert("Platform config updated.");
    } catch (err) {
      console.error(err);
      alert("Failed to save config (network error).");
    } finally {
      setConfigSaving(false);
    }
  };

  const updatePurchase = async (
    purchaseId: number,
    action: "APPROVE" | "REJECT",
  ) => {
    if (!token) return;

    let btcTxId: string | undefined;

    if (action === "APPROVE") {
      btcTxId =
        window.prompt(
          "Optional: enter the BTC transaction ID that funded this purchase:",
        ) || undefined;
    } else {
      const confirmReject = window.confirm(
        "Are you sure you want to reject this TCGold purchase?",
      );
      if (!confirmReject) return;
      btcTxId =
        window.prompt(
          "Optional: add a note or BTC tx ID for this rejection (leave blank to skip):",
        ) || undefined;
    }

    try {
      setWorkingId(purchaseId);
      const res = await fetch("/api/admin/tcg-purchases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ purchaseId, action, btcTxId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update purchase.");
        return;
      }
      fetchPurchases();
    } catch (err) {
      console.error(err);
      alert("Network error while updating purchase.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black p-6 text-slate-50">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            Admin · TCGold funding ledger
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">
            BTC-funded TCGold purchases
          </h1>
          <p className="mt-1 text-xs text-slate-400 max-w-xl">
            Configure the BTC deposit address and review incoming TCGold
            purchase requests from users.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "PENDING" | "CONFIRMED" | "REJECTED",
              )
            }
            className="rounded-lg border border-slate-800 bg-black/70 px-2 py-1 text-[11px] outline-none focus:border-gold focus:ring-1 focus:ring-gold"
          >
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Config card */}
      <section className="mb-6 rounded-3xl border border-slate-800 bg-slate-950/80 p-4 text-xs">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
          Platform configuration
        </p>
        <p className="mt-1 text-[11px] text-slate-400 max-w-xl">
          The BTC deposit address shown to users when they buy TCGold is
          controlled here. You can also adjust the default withdrawal delay
          (SLA) in days.
        </p>

        {config ? (
          <div className="mt-3 grid gap-4 md:grid-cols-[2fr,1fr]">
            <div>
              <label className="block text-[11px] text-slate-400">
                BTC deposit address for TCGold funding
                <input
                  type="text"
                  value={config.btcDepositAddress}
                  onChange={(e) =>
                    setConfig((prev) =>
                      prev
                        ? { ...prev, btcDepositAddress: e.target.value }
                        : prev,
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-black/70 px-3 py-2 text-[11px] font-mono outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                  placeholder="bc1..."
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] text-slate-400">
                Withdrawal delay (days)
                <input
                  type="number"
                  value={config.withdrawalDelayDays}
                  onChange={(e) =>
                    setConfig((prev) =>
                      prev
                        ? {
                            ...prev,
                            withdrawalDelayDays: Number(e.target.value) || 1,
                          }
                        : prev,
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-black/70 px-3 py-2 text-[11px] outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </label>
              <button
                disabled={configSaving}
                onClick={saveConfig}
                className="mt-1 w-full rounded-full bg-gold px-3 py-2 text-[11px] font-semibold text-black hover:bg-gold-soft disabled:opacity-60"
              >
                {configSaving ? "Saving…" : "Save configuration"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-slate-400">
            Loading configuration…
          </p>
        )}
      </section>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-800 bg-rose-950/80 px-4 py-3 text-xs text-rose-100">
          {error}
        </div>
      )}

      {/* Purchases table */}
      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 text-xs">
        {loading ? (
          <p className="text-slate-400 text-sm">Loading purchases…</p>
        ) : purchases.length === 0 ? (
          <p className="text-slate-400 text-sm">
            No TCGold purchases with the current filter.
          </p>
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-2xl border border-slate-900">
            <table className="min-w-full text-left text-[11px]">
              <thead className="bg-slate-900/90 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">TCGold</th>
                  <th className="px-3 py-2">USD value</th>
                  <th className="px-3 py-2">BTC address</th>
                  <th className="px-3 py-2">BTC tx</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-slate-800/80 hover:bg-slate-900/60"
                  >
                    <td className="px-3 py-2 text-slate-100">
                      {p.userEmail}
                    </td>
                    <td className="px-3 py-2 text-slate-100">{p.tcgAmount}</td>
                    <td className="px-3 py-2 text-slate-100">
                      {formatUsd(p.usdValueCents)}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      <span className="font-mono text-[10px]">
                        {p.btcAddress}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {p.btcTxId ? (
                        <span className="font-mono text-[10px]">
                          {p.btcTxId}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          p.status === "PENDING"
                            ? "rounded-full bg-amber-900/60 px-2 py-0.5 text-[10px] font-semibold text-amber-200"
                            : p.status === "CONFIRMED"
                            ? "rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-200"
                            : "rounded-full bg-rose-900/60 px-2 py-0.5 text-[10px] font-semibold text-rose-200"
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-slate-400">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {p.status === "PENDING" && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={workingId === p.id}
                            onClick={() => updatePurchase(p.id, "APPROVE")}
                            className="rounded-full bg-gold px-3 py-1 text-[10px] font-semibold text-black hover:bg-gold-soft disabled:opacity-60"
                          >
                            {workingId === p.id ? "Approving…" : "Approve"}
                          </button>
                          <button
                            disabled={workingId === p.id}
                            onClick={() => updatePurchase(p.id, "REJECT")}
                            className="rounded-full border border-rose-700 px-3 py-1 text-[10px] font-semibold text-rose-200 hover:bg-rose-950/70 disabled:opacity-60"
                          >
                            {workingId === p.id ? "Working…" : "Reject"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
