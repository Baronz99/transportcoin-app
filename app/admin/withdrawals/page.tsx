"use client";

import { useEffect, useState } from "react";
import {
  withdrawalStatusChipClasses,
  withdrawalStatusLabel,
  withdrawalStatusRank,
} from "@/lib/withdrawalStatus";

interface Withdrawal {
  id: number;
  user: { email: string };
  asset: string;
  network: string;
  address: string;
  amountTcn: number;
  status: string;
  createdAt: string;
  statusLogs?: {
    id: number;
    newStatus: string;
    note: string;
    createdAt: string;
    adminUser?: { email: string };
  }[];
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [filter, setFilter] = useState("PENDING");
  const [modalOpen, setModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"MARK_PAID" | "REJECT" | null>(
    null,
  );
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("transportcoin_token")
      : null;

  const loadData = async () => {
    const res = await fetch(`/api/admin/withdrawals?status=${filter}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }

    const sorted = [...data.withdrawals].sort((a, b) => {
      const rankDiff =
        withdrawalStatusRank(a.status) - withdrawalStatusRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    setWithdrawals(sorted);
  };

  useEffect(() => {
    if (token) loadData();
  }, [filter, token]);

  const approve = async (id: number) => {
    const res = await fetch(`/api/admin/withdrawals/${id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error);

    alert("Withdrawal approved.");
    loadData();
  };

  const openActionModal = (
    type: "MARK_PAID" | "REJECT",
    withdrawal: Withdrawal,
  ) => {
    setActionType(type);
    setSelected(withdrawal);
    setAdminNote("");
    setModalOpen(true);
  };

  const submitAction = async () => {
    if (!selected || !actionType) return;
    const note = adminNote.trim();
    if (!note) {
      alert("Admin note is required.");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint =
        actionType === "MARK_PAID"
          ? `/api/admin/withdrawals/${selected.id}/mark-paid`
          : `/api/admin/withdrawals/${selected.id}/reject`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Action failed.");
        return;
      }

      setToast(
        actionType === "MARK_PAID"
          ? "Withdrawal marked paid."
          : "Withdrawal rejected.",
      );
      setTimeout(() => setToast(null), 3500);
      setModalOpen(false);
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gold mb-4">Withdrawal Requests</h2>

      <div className="mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-black border border-gray-700 p-2"
        >
          <option value="PENDING">Pending</option>
          <option value="WAITING_QUEUE">Waiting queue</option>
          <option value="READY_FOR_PAYOUT">Ready for payout</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <table className="w-full border border-gray-700">
        <thead>
          <tr className="bg-gray-900">
            <th className="p-2">User</th>
            <th className="p-2">Asset</th>
            <th className="p-2">Network</th>
            <th className="p-2">Address</th>
            <th className="p-2">Amount (TCN)</th>
            <th className="p-2">Status</th>
            <th className="p-2">Last Action</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>

        <tbody>
          {withdrawals.map((w) => (
            <tr key={w.id} className="border-t border-gray-800">
              <td className="p-2">{w.user.email}</td>
              <td className="p-2">{w.asset}</td>
              <td className="p-2">{w.network}</td>
              <td className="p-2">{w.address.slice(0, 8)}…</td>
              <td className="p-2">{w.amountTcn}</td>
              <td className="p-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${withdrawalStatusChipClasses(
                    w.status,
                  )}`}
                >
                  {withdrawalStatusLabel(w.status)}
                </span>
              </td>
              <td className="p-2 text-[11px] text-slate-300">
                {w.statusLogs && w.statusLogs[0] ? (
                  <div className="space-y-1">
                    <div>
                      {w.statusLogs[0].newStatus} by{" "}
                      {w.statusLogs[0].adminUser?.email || "admin"}
                    </div>
                    <div className="text-slate-500">
                      {new Date(w.statusLogs[0].createdAt).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500">â€”</span>
                )}
              </td>
              <td className="p-2 space-x-2">
                {w.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => approve(w.id)}
                      className="px-2 py-1 bg-green-600"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => openActionModal("REJECT", w)}
                      className="px-2 py-1 bg-red-600"
                    >
                      Reject
                    </button>
                  </>
                )}
                {(w.status === "READY_FOR_PAYOUT" || w.status === "WAITING_QUEUE") && (
                  <>
                    <button
                      onClick={() => openActionModal("MARK_PAID", w)}
                      className="px-2 py-1 bg-emerald-600"
                    >
                      Mark Paid
                    </button>
                    <button
                      onClick={() => openActionModal("REJECT", w)}
                      className="px-2 py-1 bg-red-600"
                    >
                      Reject
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && selected && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-5 text-xs text-slate-200">
            <h3 className="text-sm font-semibold text-slate-100">
              {actionType === "MARK_PAID" ? "Confirm Mark Paid" : "Confirm Reject"}
            </h3>
            <p className="mt-2 text-[11px] text-slate-400">
              Withdrawal #{selected.id} · {selected.amountTcn} TCN ·{" "}
              {selected.asset}/{selected.network}
            </p>
            <label className="mt-4 block text-[11px] text-slate-400">
              Admin note (required)
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs text-slate-100"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-[11px]"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={submitting}
                className="rounded-lg bg-gold px-3 py-2 text-[11px] font-semibold text-black disabled:opacity-60"
              >
                {submitting ? "Working..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-40 rounded-2xl border border-emerald-700/60 bg-emerald-950/70 px-4 py-3 text-xs text-emerald-200 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
