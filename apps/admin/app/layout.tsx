import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LockedIn Admin',
  description: 'Content management dashboard for LockedIn',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-text-primary min-h-screen`}>
        <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">LockedIn Admin</h1>
          <div className="flex gap-4 text-sm text-text-secondary">
            <a href="/" className="hover:text-text-primary transition-colors">Dashboard</a>
            <a href="/schedule" className="hover:text-text-primary transition-colors">Schedule</a>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
