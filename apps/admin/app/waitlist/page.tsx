'use client';

import { Waitlist } from '@clerk/nextjs';
import { Component as EtheralShadow } from '@/components/ui/etheral-shadow';

export default function WaitlistPage() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      <EtheralShadow
        color="rgba(128, 128, 128, 1)"
        animation={{ scale: 100, speed: 90 }}
        noise={{ opacity: 1, scale: 1.2 }}
        sizing="fill"
      >
        <div className="flex flex-col items-center gap-8 px-4">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground tracking-tight">
              Locked In
            </h1>
            <p className="text-text-secondary text-sm md:text-base max-w-md mx-auto leading-relaxed">
              <span className="block text-foreground font-semibold text-base md:text-lg mb-2">
                Build discipline. Eliminate distractions. Execute daily.
              </span>
              Locked In is a system designed to help you take control of your
              attention and build real consistency.
            </p>
            <p className="text-text-secondary text-sm md:text-base">
              Join the early access waitlist.
            </p>
          </div>

          <Waitlist
            appearance={{
              elements: {
                rootBox: 'w-full max-w-sm',
                card: 'bg-surface/80 backdrop-blur-md border border-border shadow-2xl rounded-xl',
                headerTitle: 'text-foreground',
                headerSubtitle: 'text-text-secondary',
                formFieldInput:
                  'bg-background/60 border-border text-foreground placeholder:text-text-secondary focus:ring-accent focus:border-accent',
                formButtonPrimary:
                  'bg-accent hover:bg-accent-hover text-white font-medium transition-colors',
                footer: 'hidden',
              },
              layout: {
                showOptionalFields: false,
              },
            }}
          />

          <p className="text-text-secondary text-xs md:text-sm tracking-wide">
            Join <span className="text-foreground font-semibold">3,200</span> people already Locked In.
          </p>
        </div>
      </EtheralShadow>
    </div>
  );
}
