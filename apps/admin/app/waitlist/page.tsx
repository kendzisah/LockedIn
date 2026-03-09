'use client';

import { Waitlist } from '@clerk/nextjs';
import { Hero } from '@/components/ui/hero';

export default function WaitlistPage() {
  return (
    <Hero
      title="Locked In"
      subtitle="Locked In trains discipline through daily focus sessions and distraction blocking."
      titleClassName="text-5xl md:text-6xl lg:text-7xl font-extrabold"
      subtitleClassName="text-sm md:text-base max-w-[500px] leading-relaxed"
      className="min-h-screen"
    >
      <div className="relative z-50 flex flex-col items-center gap-6 -translate-y-4">
        <Waitlist
          appearance={{
            elements: {
              rootBox: 'w-full max-w-sm',
              card: 'bg-card/80 backdrop-blur-md border border-border shadow-2xl rounded-xl !text-foreground',
              headerTitle: '!text-foreground',
              headerSubtitle: '!text-muted-foreground',
              formFieldLabel: '!text-foreground',
              formFieldInput:
                '!bg-background/60 !border-border !text-foreground placeholder:!text-muted-foreground focus:!ring-primary focus:!border-primary',
              formButtonPrimary:
                '!bg-primary hover:!bg-primary/90 !text-primary-foreground font-medium transition-colors',
              footer: 'hidden',
            },
            layout: {
              showOptionalFields: false,
            },
          }}
        />

        <p className="text-muted-foreground text-xs md:text-sm tracking-wide">
          Join <span className="text-foreground font-semibold">3,214</span> people already on the waitlist.
        </p>
      </div>
    </Hero>
  );
}
