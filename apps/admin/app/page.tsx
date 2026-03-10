'use client';

import { Hero } from '@/components/ui/hero';
import { AppStoreBadge } from '@/components/ui/app-store-badge';
import { ScreenshotCarousel } from '@/components/ui/screenshot-carousel';

const APP_STORE_URL =
  'https://apps.apple.com/us/app/locked-in-mental-conditioning/id6759698565';

const screenshots = [
  { src: '/screenshots/01-program-complete.png', alt: '90 Days. Locked In.' },
  { src: '/screenshots/03-prime-mind.png', alt: 'Prime Your Mind Daily' },
  { src: '/screenshots/05-execution-block.png', alt: 'Eliminate Distractions' },
  { src: '/screenshots/02-block-apps.png', alt: 'Your Focus, Your Rules' },
  { src: '/screenshots/04-discipline-compounds.png', alt: 'Discipline Compounds' },
];

export default function HomePage() {
  return (
    <div className="bg-background min-h-screen">
      <Hero
        title="Locked In"
        subtitle="Locked In trains discipline through daily focus sessions and distraction blocking."
        titleClassName="text-5xl md:text-6xl lg:text-7xl font-extrabold"
        subtitleClassName="text-sm md:text-base max-w-[500px] leading-relaxed"
        className="min-h-[50vh]"
      >
        <div className="relative z-50 flex flex-col items-center gap-6 mt-2">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block transition-opacity hover:opacity-80"
          >
            <AppStoreBadge className="w-[180px] md:w-[200px] h-auto" />
          </a>
        </div>
      </Hero>

      <section className="py-6 md:py-8 overflow-hidden">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-8">
          Built for Discipline
        </h2>

        <ScreenshotCarousel screenshots={screenshots} />
      </section>

      <footer className="border-t border-border/40 py-8 px-4 text-center text-xs text-muted-foreground">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <span>&copy; {new Date().getFullYear()} Flock Technologies Inc.</span>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
