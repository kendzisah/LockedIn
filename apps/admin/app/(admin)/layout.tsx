import Image from 'next/image';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
        <a href="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <Image
            src="/logo.png"
            alt="LockedIn"
            width={28}
            height={28}
            className="rounded-md"
          />
          <span className="text-lg font-semibold tracking-tight">LockedIn</span>
          <span className="text-xs text-text-secondary font-medium uppercase tracking-wider mt-0.5">
            Admin
          </span>
        </a>
        <div className="flex gap-4 text-sm text-text-secondary">
          <a href="/dashboard" className="hover:text-text-primary transition-colors">Dashboard</a>
          <a href="/program" className="hover:text-text-primary transition-colors">Program</a>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </>
  );
}
