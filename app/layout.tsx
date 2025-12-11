import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "../components/Sidebar";

export const metadata: Metadata = {
  title: "Transportcoin",
  description: "Transportcoin & TCGold trading dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <Sidebar />

          {/* Right side */}
          <div className="flex min-h-screen flex-1 flex-col">
            {/* Top bar */}
            <header className="flex items-center justify-between border-b border-slate-800 bg-black/60 px-4 py-3 md:px-6">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Transportcoin
                </span>
                <span className="text-sm font-semibold text-slate-100">
                  Trading Dashboard
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-400 md:flex">
                  <span className="text-[11px] text-gold">●</span>
                  <span>Transportcoin console</span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold/80 to-gold-soft text-xs font-semibold text-black">
                  U
                </div>
              </div>
            </header>

            {/* Scrollable main content */}
            <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 via-black to-slate-950 px-4 py-5 md:px-6 md:py-6">
              <div className="mx-auto flex max-w-6xl flex-col gap-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
