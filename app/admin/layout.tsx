export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-gray-800 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-bold text-gold">Transportcoin Admin</h1>
          <nav className="flex flex-wrap gap-2 text-xs text-slate-300">
            <a
              href="/admin/tcg-ledger"
              className="rounded-full border border-gold/40 px-3 py-1.5 hover:bg-gold/10"
            >
              TCG Ledger
            </a>
            <a
              href="/admin/transport"
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:bg-slate-800/70"
            >
              Transport
            </a>
            <a
              href="/admin/withdrawals"
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:bg-slate-800/70"
            >
              Withdrawals
            </a>
          </nav>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
