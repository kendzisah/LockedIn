import Image from 'next/image';

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Locked In"
            width={28}
            height={28}
            className="rounded-md"
          />
          <span className="text-lg font-semibold tracking-tight">Locked In</span>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </>
  );
}
