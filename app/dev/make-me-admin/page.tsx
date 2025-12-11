"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MakeMeAdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      const token = localStorage.getItem("transportcoin_token");
      if (!token) {
        setStatus("error");
        setMessage("No token found. Please log in first.");
        return;
      }

      setStatus("working");
      try {
        const res = await fetch("/api/dev/make-me-admin", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "Failed to make you admin.");
          return;
        }

        setStatus("done");
        setMessage(
          `Success! You are now an admin (${data.user?.email ?? "current user"}).`,
        );

        // Optional: redirect to admin area after a short delay
        setTimeout(() => {
          router.push("/admin/transport");
        }, 1500);
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage("Network error while calling API.");
      }
    };

    run();
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-950/90 p-6 text-sm">
        <h1 className="text-lg font-semibold mb-2">Dev: Make Me Admin</h1>
        {status === "idle" && (
          <p className="text-slate-400">
            Preparing to call the admin upgrade endpoint…
          </p>
        )}
        {status === "working" && (
          <p className="text-slate-400">
            Updating your account to admin. Please wait…
          </p>
        )}
        {status === "done" && (
          <p className="text-emerald-400 font-medium">{message}</p>
        )}
        {status === "error" && (
          <p className="text-rose-400 font-medium">{message}</p>
        )}
        <p className="mt-3 text-[11px] text-slate-500">
          This page is for development only. Once you&apos;re done testing,
          you can safely delete <code>/app/dev/make-me-admin</code> and{" "}
          <code>/app/api/dev/make-me-admin</code>.
        </p>
      </div>
    </main>
  );
}
