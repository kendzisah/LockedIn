import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Locked In Waitlist',
  description: 'Build discipline. Eliminate distractions. Execute daily. Join the early access waitlist.',
};

export default function WaitlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
