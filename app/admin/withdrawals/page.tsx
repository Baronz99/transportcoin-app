"use client";

import { useEffect, useState } from "react";

interface Withdrawal {
  id: number;
  user: { email: string };
  asset: string;
  network: string;
  address: string;
  amountTcn: number;
  status: string;
  createdAt: string;
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [filter, setFilter] = useState("PENDING");

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

    setWithdrawals(data.withdrawals);
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

  const reject = async (id: number) => {
    const res = await fetch(`/api/admin/withdrawals/${id}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error);

    alert("Withdrawal rejected and refunded.");
    loadData();
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
              <td className="p-2">{w.status}</td>
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
                      onClick={() => reject(w.id)}
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
    </div>
  );
}
