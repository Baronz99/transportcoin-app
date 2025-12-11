export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-gray-800 p-4">
        <h1 className="text-xl font-bold text-gold">Transportcoin Admin</h1>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
