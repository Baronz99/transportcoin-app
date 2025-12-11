"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Wallet = {
  balance: number;
  tcGoldBalance: number;
};

type Transaction = {
  id: number;
  type: string;
  amount: number;
  status: string;
  description?: string | null;
  createdAt: string;
};

const TCN_PRICE_USD = 0.01;
const TCGOLD_PRICE_USD = 2.5;

const fmtUsd = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);

export default function TradingPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("transportcoin_token")
      : null;

  // redirect if no token
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem("transportcoin_token");
    if (!t) router.push("/login");
  }, [router]);

  // load wallet + transactions
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch("/api/wallet/summary", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          console.error(data.error);
          if (
            data.error === "Unauthorized" ||
            data.error === "User not found"
          ) {
            localStorage.removeItem("transportcoin_token");
            router.push("/login");
          }
          return;
        }
        setWallet(data.wallet);
        setTransactions(data.transactions || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, router]);

  const tcnBalance = wallet?.balance ?? 0;
  const tcgBalance = wallet?.tcGoldBalance ?? 0;

  const tcnValueUsd = tcnBalance * TCN_PRICE_USD;
  const tcgValueUsd = tcgBalance * TCGOLD_PRICE_USD;

  const tradeHistory = transactions.filter((tx) =>
    ["BUY_TCGOLD", "SELL_TCGOLD"].includes(tx.type),
  );

  if (loading && !wallet) {
    return <p className="text-sm text-slate-400">Loading trading data…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-50">Trading</h1>
        <p className="text-sm text-slate-400">
          Monitor your TCN and TCGold positions at the current reference price.
        </p>
      </div>

      {/* Balances overview */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            TCN Balance
          </p>
          <p className="mt-2 text-xl font-semibold">
            {tcnBalance}{" "}
            <span className="text-xs font-normal text-slate-400">TCN</span>
          </p>
          <p className="text-sm text-gold">{fmtUsd(tcnValueUsd)}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            TCGold Balance
          </p>
          <p className="mt-2 text-xl font-semibold">
            {tcgBalance}{" "}
            <span className="text-xs font-normal text-slate-400">TCG</span>
          </p>
          <p className="text-sm text-gold">{fmtUsd(tcgValueUsd)}</p>
        </div>

        <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 via-black to-black p-4 shadow-glow">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Market Snapshot
          </p>
          <p className="mt-2 text-lg font-semibold text-gold">
            1 TCG = {fmtUsd(TCGOLD_PRICE_USD)} ≈{" "}
            {(TCGOLD_PRICE_USD / TCN_PRICE_USD).toFixed(0)} TCN
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            For this console, TCGold trades at a fixed USD price set by
            Transportcoin. In the future, this can become market-driven.
          </p>
        </div>
      </section>

      {/* TCGold Trade History only */}
      <section>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <h3 className="text-sm font-semibold text-slate-100">
            TCGold Trade History
          </h3>
          <p className="mb-2 text-[11px] text-slate-400">
            Historical TCGold buy and sell operations will appear here.
          </p>
          {tradeHistory.length === 0 ? (
            <p className="text-sm text-slate-500">
              No TCGold trades recorded yet.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-800">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-[11px] uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Side</th>
                    <th className="px-3 py-2">Amount (TCG)</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeHistory.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-t border-slate-800/70 hover:bg-slate-900/70"
                    >
                      <td className="px-3 py-2 font-medium text-slate-100">
                        {tx.type === "BUY_TCGOLD" ? "BUY" : "SELL"}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {tx.amount}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                            tx.status === "SUCCESS"
                              ? "bg-emerald-900/60 text-emerald-300"
                              : tx.status === "PENDING"
                              ? "bg-amber-900/60 text-amber-300"
                              : "bg-rose-900/60 text-rose-300"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-400">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
