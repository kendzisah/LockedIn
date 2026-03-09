import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
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
    <ClerkProvider
      appearance={{ baseTheme: dark }}
      localization={{
        waitlist: {
          start: {
            title: 'Join the Waitlist',
            subtitle: 'Enter your email to reserve your spot.',
          },
          success: {
            title: "You're on the list!",
            subtitle: "We'll notify you once the app is available.",
          },
        },
      }}
    >
      <html lang="en" className="dark">
        <body className={`${inter.className} bg-background text-text-primary min-h-screen`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
