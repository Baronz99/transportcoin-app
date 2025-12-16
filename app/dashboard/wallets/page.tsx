// app/dashboard/wallets/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type WalletSummary = {
  balance: number; // TCN
  tcGoldBalance: number; // TCGold
  usableUsdCents: number; // USD cents
};

type Transaction = {
  id: number;
  type: string;
  amount: number;
  status: string;
  description?: string | null;
  adminNote?: string | null; // ✅ ADDED
  createdAt: string;
};

type LastPurchase = {
  id: number;
  tcgAmount: number;
  usdValueCents: number;
  btcAddress: string;
  status: string;
};

// IMPORTANT: You said TCN = $1
const TCN_USD = 1;
const TCG_USD = 2.5;

const formatUsd = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// 100,000 TCN => 1,000 TCG (1%); min 1 TCG
const requiredTcgForWithdrawal = (amountTcn: number) =>
  Math.max(1, Math.ceil(amountTcn / 100));

export default function WalletsPage() {
  const router = useRouter();
  const buySectionRef = useRef<HTMLDivElement | null>(null);

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAsset, setWithdrawAsset] = useState("BTC");
  const [withdrawNetwork, setWithdrawNetwork] = useState("BTC");
  const [withdrawAddress, setWithdrawAddress] = useState("");

  const [tcgBuyAmount, setTcgBuyAmount] = useState("");
  const [lastPurchase, setLastPurchase] = useState<LastPurchase | null>(null);

  const [loading, setLoading] = useState(false);
  const [openingThreadId, setOpeningThreadId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("transportcoin_token")
      : null;

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadSummary = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/wallet/summary", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load wallet.");
        return;
      }

      setWallet({
        balance: data.wallet.balance,
        tcGoldBalance: data.wallet.tcGoldBalance ?? 0,
        usableUsdCents: data.wallet.usableUsdCents ?? 0,
      });

      setTransactions(data.transactions || []);
    } catch (err) {
      console.error(err);
      setError("Network error loading wallet.");
    }
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const withdrawAmtNum = Number(withdrawAmount || 0);
  const requiredTcg = useMemo(() => {
    if (!withdrawAmtNum || withdrawAmtNum <= 0) return 0;
    if (!Number.isInteger(withdrawAmtNum)) return 0;
    return requiredTcgForWithdrawal(withdrawAmtNum);
  }, [withdrawAmtNum]);

  const currentTcg = wallet?.tcGoldBalance ?? 0;

  // -------- Withdraw crypto --------
  const handleWithdrawCrypto = async () => {
    if (!token) return;

    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0 || !Number.isInteger(amt)) {
      alert("Enter a valid TCN amount (whole number).");
      return;
    }
    if (!withdrawAddress.trim()) {
      alert("Enter a destination address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/wallet/withdraw-crypto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amt,
          asset: withdrawAsset,
          network: withdrawNetwork,
          address: withdrawAddress.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.code === "INSUFFICIENT_TCGOLD") {
          const msg =
            data?.error ||
            "You need more TCGold to complete this withdrawal. Please buy TCGold and try again.";
          alert(msg);

          setTimeout(() => {
            buySectionRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 50);

          return;
        }

        setError(data.error || "Withdrawal failed.");
        return;
      }

      setWallet({
        balance: data.wallet.balance,
        tcGoldBalance: data.wallet.tcGoldBalance ?? 0,
        usableUsdCents: data.wallet.usableUsdCents ?? 0,
      });

      if (data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev]);
      }

      setWithdrawAmount("");
      setWithdrawAddress("");
      alert("Withdrawal request submitted. Pending admin approval.");
    } catch (err) {
      console.error(err);
      setError("Withdrawal error.");
    } finally {
      setLoading(false);
    }
  };

  // -------- Buy TCGold (BTC deposit request) --------
  const handleBuyTcGold = async () => {
    if (!token) return;

    const amt = Number(tcgBuyAmount);
    if (!amt || amt <= 0 || !Number.isInteger(amt)) {
      alert("Enter a valid TCGold amount (whole number).");
      return;
    }

    setLoading(true);
    setError(null);
    setLastPurchase(null);

    try {
      const res = await fetch("/api/trade/buy-tcgold", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amountTcg: amt }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "TCGold purchase failed.");
        return;
      }

      const p = data.purchase;
      setLastPurchase({
        id: p.id,
        tcgAmount: p.tcgAmount,
        usdValueCents: p.usdValueCents,
        btcAddress: p.btcAddress,
        status: p.status,
      });

      if (data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev]);
      }

      setTcgBuyAmount("");
      await loadSummary();
    } catch (err) {
      console.error(err);
      setError("TCGold purchase error.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: open (or create) support thread for a withdrawal transaction
  const openSupportThreadForTransaction = async (transactionId: number) => {
    if (!token) return;

    setOpeningThreadId(transactionId);

    try {
      const res = await fetch("/api/support/thread-for-transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transactionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Failed to open support thread.");
        return;
      }

      // Expecting { threadId, withdrawalRequestId }
      router.push(`/dashboard/support/threads/${data.threadId}`);
    } catch (err) {
      console.error(err);
      alert("Network error opening support thread.");
    } finally {
      setOpeningThreadId(null);
    }
  };

  const totalUsd =
    (wallet?.usableUsdCents ?? 0) / 100 +
    (wallet?.balance ?? 0) * TCN_USD +
    (wallet?.tcGoldBalance ?? 0) * TCG_USD;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black p-6 text-slate-50">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
          Wallets
        </p>
        <h1 className="mt-1 text-xl font-semibold">Transportcoin Balance</h1>
        <p className="mt-1 text-xs text-slate-400 max-w-xl">
          View balances and initiate crypto withdrawals and TCGold purchases
          funded via BTC.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-700 bg-rose-900/50 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Portfolio */}
      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-yellow-600/10 to-black p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold">
            Total Portfolio Value
          </p>
          <p className="mt-1 text-2xl font-semibold text-gold">
            {formatUsd(Math.round(totalUsd * 100))}
          </p>
          <p className="mt-1 text-[11px] text-slate-300">
            Aggregate of TCN, TCGold and any usable USD balance.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            TCN · Transportcoin
          </p>
          <p className="mt-1 text-lg font-semibold">{wallet?.balance ?? 0} TCN</p>
          <p className="text-xs text-slate-400">
            ~{formatUsd(Math.round((wallet?.balance ?? 0) * TCN_USD * 100))}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            TCG · TCGold
          </p>
          <p className="mt-1 text-lg font-semibold">{wallet?.tcGoldBalance ?? 0} TCG</p>
          <p className="text-xs text-slate-400">
            ~{formatUsd(Math.round((wallet?.tcGoldBalance ?? 0) * TCG_USD * 100))}
          </p>
        </div>
      </section>

      {/* Actions */}
      <section className="mb-10 grid gap-6 lg:grid-cols-2">
        {/* Withdraw */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Request Crypto Withdrawal
          </p>
          <p className="mt-1 text-xs text-slate-300">
            Withdrawals require holding TCGold equal to{" "}
            <b>1% of the withdrawal amount</b> (e.g. 100,000 TCN → 1,000 TCG).
          </p>

          <div className="mt-4 space-y-3 text-xs">
            <label className="block text-slate-400">
              Amount (TCN)
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              />
            </label>

            {withdrawAmtNum > 0 && Number.isInteger(withdrawAmtNum) && (
              <div className="rounded-xl border border-slate-800 bg-black/50 px-3 py-2 text-[11px] text-slate-300">
                <div className="flex items-center justify-between gap-2">
                  <span>Required TCGold (hold):</span>
                  <span className="font-semibold text-gold">
                    {requiredTcg.toLocaleString()} TCG
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span>Your TCGold:</span>
                  <span
                    className={`font-semibold ${
                      currentTcg >= requiredTcg ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {currentTcg.toLocaleString()} TCG
                  </span>
                </div>
                {currentTcg < requiredTcg && (
                  <p className="mt-2 text-[10px] text-amber-200">
                    You don’t have enough TCGold yet — submit anyway and we’ll prompt you to buy TCGold.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <label className="flex-1 text-slate-400">
                Asset
                <select
                  value={withdrawAsset}
                  onChange={(e) => setWithdrawAsset(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-black/60 px-2 py-2 text-xs outline-none focus:border-gold"
                >
                  <option>BTC</option>
                  <option>ETH</option>
                  <option>USDT</option>
                  <option>USDC</option>
                </select>
              </label>

              <label className="flex-1 text-slate-400">
                Network
                <select
                  value={withdrawNetwork}
                  onChange={(e) => setWithdrawNetwork(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-black/60 px-2 py-2 text-xs outline-none focus:border-gold"
                >
                  <option>BTC</option>
                  <option>ERC20</option>
                  <option>TRC20</option>
                  <option>BEP20</option>
                </select>
              </label>
            </div>

            <label className="block text-slate-400">
              Destination address
              <input
                type="text"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold"
              />
            </label>

            <button
              onClick={handleWithdrawCrypto}
              disabled={loading}
              className="mt-3 w-full rounded-full border border-gold px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-60"
            >
              {loading ? "Working…" : "Submit Withdrawal Request"}
            </button>
          </div>
        </div>

        {/* Buy TCGold */}
        <div
          ref={buySectionRef}
          className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Buy TCGold with BTC
          </p>
          <p className="mt-1 text-xs text-slate-300">
            Create a purchase request and receive BTC payment details.
          </p>

          <div className="mt-4 space-y-3 text-xs">
            <label className="block text-slate-400">
              Amount (TCGold tokens)
              <input
                type="number"
                value={tcgBuyAmount}
                onChange={(e) => setTcgBuyAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              />
            </label>
            <p className="text-[10px] text-slate-500">
              1 TCGold ≈ ${TCG_USD.toFixed(2)} (internal rate).
            </p>

            <button
              onClick={handleBuyTcGold}
              disabled={loading}
              className="mt-2 w-full rounded-full bg-gold px-3 py-2 text-xs font-semibold text-black hover:bg-gold/90 disabled:opacity-60"
            >
              {loading ? "Working…" : "Create TCGold purchase request"}
            </button>

            {lastPurchase && (
              <div className="mt-3 rounded-xl border border-amber-800 bg-amber-950/40 px-3 py-3 text-[11px] text-amber-100 space-y-1">
                <p className="font-semibold text-amber-200">
                  TCGold purchase created (pending)
                </p>
                <p>
                  <span className="text-slate-300">Amount:</span>{" "}
                  {lastPurchase.tcgAmount} TCG ({formatUsd(lastPurchase.usdValueCents)})
                </p>
                <p>
                  <span className="text-slate-300">Send BTC to:</span>
                  <br />
                  <span className="font-mono text-[10px]">
                    {lastPurchase.btcAddress}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Transactions */}
      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 text-xs">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
          Recent Transactions
        </p>

        {transactions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No wallet activity yet. Once you start purchasing TCGold or
            requesting withdrawals, history will appear here.
          </p>
        ) : (
          <div className="mt-4 max-h-[400px] overflow-auto rounded-2xl border border-slate-900">
            <table className="min-w-full text-left text-[11px]">
              <thead className="bg-slate-900/90 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Details</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-t border-slate-900 hover:bg-slate-900/60 align-top"
                  >
                    <td className="px-3 py-2">{tx.type}</td>
                    <td className="px-3 py-2">{tx.amount}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          tx.status === "SUCCESS"
                            ? "rounded-full bg-emerald-900/50 px-2 py-0.5 text-emerald-200"
                            : tx.status === "PENDING"
                            ? "rounded-full bg-amber-900/50 px-2 py-0.5 text-amber-200"
                            : "rounded-full bg-rose-900/50 px-2 py-0.5 text-rose-200"
                        }
                      >
                        {tx.status}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-slate-300">
                      <div className="space-y-1">
                        <div>{tx.description || "—"}</div>

                        {/* ✅ ADMIN NOTE */}
                        {tx.adminNote && tx.adminNote.trim().length > 0 && (
                          <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-2 py-1 text-[10px] text-amber-200">
                            <span className="font-semibold text-amber-300">
                              Admin note:
                            </span>{" "}
                            {tx.adminNote}
                          </div>
                        )}

                        {/* ✅ MESSAGE ADMIN (only for pending withdrawals) */}
                        {tx.type === "WITHDRAW_CRYPTO_REQUEST" &&
                          tx.status === "PENDING" && (
                            <button
                              onClick={() =>
                                openSupportThreadForTransaction(tx.id)
                              }
                              disabled={openingThreadId === tx.id}
                              className="mt-2 rounded-lg border border-gold/50 bg-black/40 px-2 py-1 text-[10px] font-semibold text-gold hover:bg-gold/10 disabled:opacity-60"
                            >
                              {openingThreadId === tx.id
                                ? "Opening…"
                                : "Message admin"}
                            </button>
                          )}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-[10px] text-slate-500">
                      {new Date(tx.createdAt).toLocaleString()}
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
