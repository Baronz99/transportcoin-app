// app/admin/transport/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminEvent = {
  id: number;
  type: string;
  label: string;
  route?: string | null;
  vehicleId?: string | null;
  location?: string | null;
  amountFuelLitres?: number | null;
  amountTcn?: number | null;
  amountTcg?: number | null;
  createdAt: string;
  user: { email: string };
};

const EVENT_TYPES = [
  "FUEL",
  "TRIP_START",
  "TRIP_END",
  "CHECKPOINT",
  "REWARD_TCN",
  "REWARD_TCG",
] as const;

export default function AdminTransportPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("");
  const [type, setType] = useState<(typeof EVENT_TYPES)[number]>("TRIP_START");
  const [label, setLabel] = useState("Trip started: City shuttle");
  const [route, setRoute] = useState("Line A12 - Central ↔ Port");
  const [vehicleId, setVehicleId] = useState("BUS-204");
  const [location, setLocation] = useState("Central Station");
  const [amountFuelLitres, setAmountFuelLitres] = useState<string>("");
  const [amountTcn, setAmountTcn] = useState<string>("");
  const [amountTcg, setAmountTcg] = useState<string>("");

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("transportcoin_token")
      : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem("transportcoin_token");
    if (!t) {
      router.push("/login");
      return;
    }
  }, [router]);

  const loadEvents = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/transport/events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load events.");
        return;
      }
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCreate = async () => {
    if (!token) return;
    if (!userEmail.trim()) {
      alert("Enter a user email.");
      return;
    }
    if (!label.trim()) {
      alert("Enter a label/description for the event.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/transport/events/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userEmail: userEmail.trim(),
          type,
          label: label.trim(),
          route: route || null,
          vehicleId: vehicleId || null,
          location: location || null,
          amountFuelLitres: amountFuelLitres
            ? Number(amountFuelLitres)
            : undefined,
          amountTcn: amountTcn ? Number(amountTcn) : undefined,
          amountTcg: amountTcg ? Number(amountTcg) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Error creating event.");
      } else {
        alert("Transport event created.");
        setAmountFuelLitres("");
        setAmountTcn("");
        setAmountTcg("");
        loadEvents();
      }
    } catch (err) {
      console.error(err);
      alert("Network error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-50">
          Transport Events (Admin)
        </h1>
        <p className="text-sm text-slate-400">
          Trigger real transport activity events for specific users. These will
          appear on their Transport Activity page and contribute to their Proof
          of Movement history.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800 bg-rose-950/70 px-4 py-3 text-xs text-rose-100">
          {error}
        </div>
      )}

      {/* Create event form */}
      <section className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300">
          <h2 className="text-sm font-semibold text-slate-100">
            Create transport event
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Use this form to simulate real-world operations: trips, fuel
            purchases, checkpoints, and rewards. These events are stored
            permanently for the user.
          </p>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">User email</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Event type</label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as (typeof EVENT_TYPES)[number])
                  }
                  className="w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">
                  Short label / description
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Trip started: City shuttle"
                  className="w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">
                  Route (optional)
                </label>
                <input
                  type="text"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="Line A12 - Central ↔ Port"
                  className="w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">
                  Vehicle ID (optional)
                </label>
                <input
                  type="text"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  placeholder="BUS-204"
                  className="w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Central Station"
                className="w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">
                  Fuel (L, optional)
                </label>
                <input
                  type="number"
                  value={amountFuelLitres}
                  onChange={(e) => setAmountFuelLitres(e.target.value)}
                  placeholder="e.g. 80"
                  className="w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">
                  TCN amount (optional)
                </label>
                <input
                  type="number"
                  value={amountTcn}
                  onChange={(e) => setAmountTcn(e.target.value)}
                  placeholder="e.g. 400"
                  className="w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">
                  TCG amount (optional)
                </label>
                <input
                  type="number"
                  value={amountTcg}
                  onChange={(e) => setAmountTcg(e.target.value)}
                  placeholder="e.g. 2"
                  className="w-full rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={creating}
              className="mt-3 rounded-xl bg-gold px-3 py-2 text-[11px] font-semibold text-black hover:bg-gold-soft disabled:opacity-60"
            >
              {creating ? "Creating event…" : "Create transport event"}
            </button>
          </div>
        </div>

        {/* Recent events */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300">
          <h2 className="text-sm font-semibold text-slate-100">
            Recent transport events
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Latest Proof of Movement events across users. Filter at API level
            by email if needed.
          </p>

          {loading ? (
            <p className="mt-3 text-[11px] text-slate-400">
              Loading events…
            </p>
          ) : events.length === 0 ? (
            <p className="mt-3 text-[11px] text-slate-400">
              No events yet. Create one with the form on the left.
            </p>
          ) : (
            <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-slate-800">
              <table className="min-w-full text-left text-[11px]">
                <thead className="bg-slate-900/90 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Label</th>
                    <th className="px-3 py-2">Amounts</th>
                    <th className="px-3 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-slate-800/70 hover:bg-slate-900/70"
                    >
                      <td className="px-3 py-2 text-slate-200">
                        {e.user.email}
                      </td>
                      <td className="px-3 py-2 text-slate-100">{e.type}</td>
                      <td className="px-3 py-2 text-slate-200">
                        {e.label}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {e.amountFuelLitres
                          ? `${e.amountFuelLitres}L `
                          : ""}
                        {e.amountTcn ? `• ${e.amountTcn} TCN ` : ""}
                        {e.amountTcg ? `• ${e.amountTcg} TCG` : ""}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-400">
                        {new Date(e.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
