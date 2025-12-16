"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";

type SupportMessage = {
  id: number;
  sender: string;
  body: string;
  createdAt: string;
};

type Thread = {
  id: number;
  status: string;
  withdrawalRequest: null | {
    id: number;
    asset: string;
    network: string;
    address: string;
    amountTcn: number;
    status: string;
    createdAt: string;
  };
  messages: SupportMessage[];
};

export default function SupportThreadPage() {
  const router = useRouter();
  const params = useParams<{ threadId: string }>();

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("transportcoin_token")
      : null;

  const threadId = useMemo(() => Number(params?.threadId), [params]);

  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");

  const load = async () => {
    if (!token) {
      router.push("/login");
      return;
    }
    if (!threadId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/support/threads/${threadId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to load thread.");
        return;
      }

      setThread(data.thread);
    } catch (e) {
      console.error(e);
      setError("Network error loading thread.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const send = async () => {
    if (!token) return;
    const text = body.trim();
    if (!text) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/support/threads/${threadId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: text }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to send message.");
        return;
      }

      setBody("");
      await load(); // simplest + consistent
    } catch (e) {
      console.error(e);
      setError("Network error sending message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black p-6 text-slate-50">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="rounded-xl border border-slate-800 bg-black/50 px-3 py-2 text-xs hover:border-slate-600"
        >
          ← Back
        </button>

        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Support Thread
          </p>
          <p className="text-xs text-slate-300">Thread #{threadId}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-700 bg-rose-900/50 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">Loading messages…</div>
      ) : !thread ? (
        <div className="text-sm text-slate-400">Thread not found.</div>
      ) : (
        <>
          {thread.withdrawalRequest && (
            <div className="mb-4 rounded-2xl border border-slate-800 bg-black/40 p-4 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-100">
                  Withdrawal #{thread.withdrawalRequest.id}
                </p>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300">
                  {thread.withdrawalRequest.status}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {thread.withdrawalRequest.amountTcn.toLocaleString()} TCN ·{" "}
                {thread.withdrawalRequest.asset}/{thread.withdrawalRequest.network}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 break-all">
                Address: {thread.withdrawalRequest.address}
              </p>
            </div>
          )}

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {thread.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-2xl border px-3 py-2 text-xs ${
                    m.sender === "USER"
                      ? "border-gold/30 bg-black/60"
                      : "border-slate-700 bg-slate-900/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      {m.sender}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-100 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message to admin…"
                className="flex-1 rounded-xl border border-slate-800 bg-black/60 px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              />
              <button
                onClick={send}
                disabled={sending || !body.trim()}
                className="rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-black disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>

            <p className="mt-2 text-[10px] text-slate-500">
              You can send unlimited messages. Admin replies will appear here.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
