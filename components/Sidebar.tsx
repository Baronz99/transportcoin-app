"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "●" },
  { label: "Wallets", href: "/dashboard/wallets", icon: "💳" },
  { label: "Trading", href: "/dashboard/trading", icon: "📈" },
  { label: "Transport Activity", href: "/dashboard/transport", icon: "🚌" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-800 bg-black/80 px-4 py-5 md:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-gold/70 bg-slate-950 shadow-glow">
          <span className="text-lg font-bold text-gold">T</span>
        </div>
        <div>
          <div className="text-sm font-semibold tracking-wide">
            Transportcoin
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Trading Console
          </div>
        </div>
      </div>

      <nav className="space-y-1 text-sm text-slate-400">
        <div className="px-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
          Main
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          const baseClasses =
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 transition-colors";
          const activeClasses =
            "bg-gradient-to-r from-gold/15 via-gold/5 to-transparent text-gold shadow-glow";
          const inactiveClasses = "hover:bg-slate-900/60";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${baseClasses} ${
                isActive ? activeClasses : inactiveClasses
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}

        <div className="mt-6 px-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
          System
        </div>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500">
          <span className="text-[10px]">●</span>
          <span>Transportcoin Console</span>
        </div>
      </nav>

      <div className="mt-auto rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-black to-black px-3 py-3 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.25em] text-gold">
            TCG
          </span>
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-gold-soft">
            v3.2 • TC Network
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-400">
          Live console to manage Transportcoin wallets
          &amp; TCGold.
        </p>
      </div>
    </aside>
  );
}
