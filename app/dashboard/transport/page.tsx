"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TransportEvent = {
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
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });

const typeLabel = (t: string) => {
  switch (t) {
    case "FUEL":
      return "Fuel purchase";
    case "TRIP_START":
      return "Trip started";
    case "TRIP_END":
      return "Trip completed";
    case "CHECKPOINT":
      return "Route checkpoint";
    case "REWARD_TCN":
      return "TCN reward";
    case "REWARD_TCG":
      return "TCGold reward";
    default:
      return t;
  }
};

const typeChipClass = (t: string) => {
  switch (t) {
    case "FUEL":
      return "bg-amber-900/60 text-amber-200";
    case "TRIP_START":
      return "bg-sky-900/60 text-sky-200";
    case "TRIP_END":
      return "bg-emerald-900/60 text-emerald-200";
    case "CHECKPOINT":
      return "bg-slate-800 text-slate-200";
    case "REWARD_TCN":
      return "bg-gold/15 text-gold border border-gold/40";
    case "REWARD_TCG":
      return "bg-purple-900/60 text-purple-200";
    default:
      return "bg-slate-800 text-slate-200";
  }
};

export default function TransportActivityPage() {
  const router = useRouter();
  const [events, setEvents] = useState<TransportEvent[]>([]);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/transport/events", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          if (
            data.error === "Unauthorized" ||
            data.error === "User not found"
          ) {
            localStorage.removeItem("transportcoin_token");
            router.push("/login");
          } else {
            console.error(data.error || "Error loading events");
          }
        } else {
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, router]);

  const filteredEvents = useMemo(
    () =>
      filterType === "ALL"
        ? events
        : events.filter((e) => e.type === filterType),
    [events, filterType],
  );

  const totalFuel = useMemo(
    () =>
      events.reduce(
        (sum, e) => sum + (e.amountFuelLitres ? e.amountFuelLitres : 0),
        0,
      ),
    [events],
  );

  const totalTcnRewards = useMemo(
    () =>
      events.reduce(
        (sum, e) =>
          sum + (e.type === "REWARD_TCN" && e.amountTcn ? e.amountTcn : 0),
        0,
      ),
    [events],
  );

  const totalTcgRewards = useMemo(
    () =>
      events.reduce(
        (sum, e) =>
          sum + (e.type === "REWARD_TCG" && e.amountTcg ? e.amountTcg : 0),
        0,
      ),
    [events],
  );

  const tripsCompleted = useMemo(
    () => events.filter((e) => e.type === "TRIP_END").length,
    [events],
  );

  const impliedRewardRate =
    totalFuel > 0 ? (totalTcnRewards / totalFuel).toFixed(2) : "—";

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black p-6 text-slate-50">
      {/* HEADER */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
          Transport Activity · Proof of Movement
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          Your movement footprint on the{" "}
          <span className="text-gold">
            Transport Blockchain Settlement Layer
          </span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Every trip, fuel stop, checkpoint and reward below represents a real
          event stored for your account. Admin-triggered operations and later
          live integrations will continue to build this history over time.
        </p>
      </div>

      {/* SUMMARY STRIP */}
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 via-black to-black p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Trips completed
          </p>
          <p className="mt-2 text-2xl font-semibold text-gold">
            {tripsCompleted}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            End-of-route events linked to your wallet identity.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Fuel volume tracked
          </p>
          <p className="mt-2 text-xl font-semibold">
            {totalFuel}{" "}
            <span className="text-xs font-normal text-slate-400">L</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Fuel events that can feed into rebates and fleet analytics.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            TCN rewards from movement
          </p>
          <p className="mt-2 text-xl font-semibold">
            {totalTcnRewards}{" "}
            <span className="text-xs font-normal text-slate-400">TCN</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Earned from performance-linked and route-linked events.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            TCGold micro-stakes
          </p>
          <p className="mt-2 text-xl font-semibold">
            {totalTcgRewards}{" "}
            <span className="text-xs font-normal text-slate-400">TCG</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Longer-term alignment with the Transportcoin settlement layer.
          </p>
        </div>
      </section>

      {/* LOWER GRID */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)]">
        {/* Timeline */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Movement timeline
              </h2>
              <p className="text-[11px] text-slate-500">
                Your most recent transport and reward events, recorded against
                your Transportcoin identity.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="hidden md:inline">Filter:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-slate-800 bg-black/70 px-2 py-1 text-[11px] outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              >
                <option value="ALL">All events</option>
                <option value="TRIP_START">Trip starts</option>
                <option value="TRIP_END">Trip completions</option>
                <option value="FUEL">Fuel</option>
                <option value="CHECKPOINT">Checkpoints</option>
                <option value="REWARD_TCN">TCN rewards</option>
                <option value="REWARD_TCG">TCGold rewards</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">
              Loading your transport events…
            </p>
          ) : filteredEvents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No transport events have been recorded for your account yet.
              These will appear as your operator or admin begins syncing trips,
              fuel, and rewards into the network.
            </p>
          ) : (
            <div className="relative mt-3 max-h-[420px] overflow-y-auto">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-800" />
              <ul className="space-y-3 pl-10 text-xs">
                {filteredEvents.map((event) => (
                  <li
                    key={event.id}
                    className="relative rounded-2xl border border-slate-800/80 bg-black/60 px-3 py-2"
                  >
                    <span className="absolute left-[-22px] top-2 h-3 w-3 rounded-full border border-gold bg-black shadow-[0_0_0_2px_rgba(0,0,0,1)]" />

                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-100">
                            {event.label}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeChipClass(
                              event.type,
                            )}`}
                          >
                            {typeLabel(event.type)}
                          </span>
                        </div>

                        {event.route && (
                          <p className="text-[11px] text-slate-400">
                            Route:{" "}
                            <span className="font-medium text-slate-100">
                              {event.route}
                            </span>
                          </p>
                        )}
                        {event.vehicleId && (
                          <p className="text-[11px] text-slate-400">
                            Vehicle:{" "}
                            <span className="font-medium text-slate-100">
                              {event.vehicleId}
                            </span>
                          </p>
                        )}
                        {event.location && (
                          <p className="text-[11px] text-slate-500">
                            Location:{" "}
                            <span className="font-medium text-slate-100">
                              {event.location}
                            </span>
                          </p>
                        )}

                        {(event.amountFuelLitres ||
                          event.amountTcn ||
                          event.amountTcg) && (
                          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-300">
                            {event.amountFuelLitres && (
                              <span>
                                Fuel:{" "}
                                <span className="font-semibold">
                                  {event.amountFuelLitres} L
                                </span>
                              </span>
                            )}
                            {event.amountTcn && (
                              <span>
                                TCN:{" "}
                                <span className="font-semibold">
                                  {event.amountTcn}
                                </span>
                              </span>
                            )}
                            {event.amountTcg && (
                              <span>
                                TCG:{" "}
                                <span className="font-semibold">
                                  {event.amountTcg}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-slate-500">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Fuel → TCN conversion explanation */}
        <div className="space-y-4 text-xs">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <h3 className="text-sm font-semibold text-slate-100">
              Fuel → value mapping
            </h3>
            <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
              Fuel consumption and route consistency can be mapped into TCN
              rewards at the protocol or fleet level. As more of your trips are
              fed into Transportcoin, the relationship between litres consumed
              and value created becomes visible here.
            </p>
            <div className="mt-3 space-y-1 text-[11px] text-slate-300">
              <p>
                • Total fuel volume tracked:{" "}
                <span className="font-semibold text-slate-50">
                  {totalFuel} L
                </span>
              </p>
              <p>
                • Total TCN rewards from movement:{" "}
                <span className="font-semibold text-slate-50">
                  {totalTcnRewards} TCN
                </span>
              </p>
              <p>
                • Implied reward rate:{" "}
                <span className="font-semibold text-gold">
                  {impliedRewardRate === "—"
                    ? "Not enough data yet"
                    : `${impliedRewardRate} TCN per litre`}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <h3 className="text-sm font-semibold text-slate-100">
              From activity feed to settlement trail
            </h3>
            <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
              The events in this panel are candidates for on-chain settlement
              under the Transport Blockchain Settlement Layer (TBSL). As more
              operators connect, this view becomes a full history of how your
              transport footprint generates TCN and TCGold over time.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}