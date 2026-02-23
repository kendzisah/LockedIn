import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Image from 'next/image';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LockedIn Admin',
  description: 'Content management dashboard for LockedIn',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
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
          <a href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
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
            <a href="/" className="hover:text-text-primary transition-colors">Dashboard</a>
            <a href="/program" className="hover:text-text-primary transition-colors">Program</a>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
