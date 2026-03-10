'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Screenshot {
  src: string;
  alt: string;
}

interface ScreenshotCarouselProps {
  screenshots: Screenshot[];
  className?: string;
}

export function ScreenshotCarousel({ screenshots, className }: ScreenshotCarouselProps) {
  const [active, setActive] = useState(0);
  const count = screenshots.length;

  const prev = useCallback(() => setActive((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setActive((i) => (i + 1) % count), [count]);

  const getCircularOffset = (index: number) => {
    let diff = index - active;
    if (diff > count / 2) diff -= count;
    if (diff < -count / 2) diff += count;
    return diff;
  };

  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div className="relative w-full flex items-center justify-center h-[480px] md:h-[540px]">
        <button
          onClick={prev}
          className="absolute left-2 md:left-8 z-30 w-10 h-10 rounded-full bg-card/80 backdrop-blur border border-border/50 flex items-center justify-center text-foreground hover:bg-card transition-colors"
          aria-label="Previous screenshot"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="relative w-full h-full flex items-center justify-center">
          {screenshots.map((shot, index) => {
            const offset = getCircularOffset(index);
            const absOffset = Math.abs(offset);
            const isActive = offset === 0;

            return (
              <motion.div
                key={shot.src}
                animate={{
                  x: `${offset * 55}%`,
                  scale: isActive ? 1 : 0.7 - absOffset * 0.05,
                  opacity: isActive ? 1 : absOffset <= 1 ? 0.5 : 0.25,
                  zIndex: count - absOffset,
                  filter: isActive ? 'blur(0px)' : `blur(${absOffset * 2.5}px)`,
                }}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                className="absolute cursor-pointer"
                onClick={() => !isActive && setActive(index)}
              >
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  width={260}
                  height={520}
                  className={cn(
                    'rounded-2xl shadow-2xl',
                    isActive ? 'shadow-primary/20' : 'shadow-black/40',
                  )}
                  priority={index === 0}
                />
              </motion.div>
            );
          })}
        </div>

        <button
          onClick={next}
          className="absolute right-2 md:right-8 z-30 w-10 h-10 rounded-full bg-card/80 backdrop-blur border border-border/50 flex items-center justify-center text-foreground hover:bg-card transition-colors"
          aria-label="Next screenshot"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2 mt-6">
        {screenshots.map((_, index) => (
          <button
            key={index}
            onClick={() => setActive(index)}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              index === active
                ? 'bg-primary w-6'
                : 'bg-muted-foreground/40 hover:bg-muted-foreground/60',
            )}
            aria-label={`Go to screenshot ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
