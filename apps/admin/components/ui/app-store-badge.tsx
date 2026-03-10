'use client';

import { cn } from '@/lib/utils';

export function AppStoreBadge({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      {/* Rotating conic gradient border */}
      <div
        className="absolute -inset-[2px] rounded-xl"
        style={{
          background: 'conic-gradient(from var(--angle), transparent 60%, rgba(255,255,255,0.9) 78%, white 80%, rgba(255,255,255,0.9) 82%, transparent 100%)',
          animation: 'border-spin 3s linear infinite',
        }}
      />

      {/* Inner black fill */}
      <div className="absolute inset-[1px] rounded-[10px] bg-black" />

      {/* Surface glow that follows the rotation */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none opacity-30"
        style={{
          background: 'conic-gradient(from var(--angle), transparent 65%, rgba(255,255,255,0.3) 80%, transparent 95%)',
          animation: 'border-spin 3s linear infinite',
        }}
      />

      <svg
        className="relative w-full h-auto"
        viewBox="0 0 120 40"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Download on the App Store"
      >
        <title>Download on the App Store</title>
        <g>
          <rect width="120" height="40" rx="5" fill="transparent" />
          <text fill="#fff" fontFamily="system-ui, -apple-system, sans-serif" fontSize="8" x="38" y="12" letterSpacing="0.03em">Download on the</text>
          <text fill="#fff" fontFamily="system-ui, -apple-system, sans-serif" fontSize="14" fontWeight="600" x="37.5" y="28">App Store</text>
          <g transform="translate(10, 6) scale(0.55)">
            <path d="M24.769 20.3a5.98 5.98 0 0 1 2.849-5.016 6.128 6.128 0 0 0-4.828-2.61c-2.03-.214-4.015 1.217-5.053 1.217-1.056 0-2.644-1.2-4.363-1.163a6.424 6.424 0 0 0-5.412 3.293c-2.338 4.04-.595 9.983 1.646 13.255 1.12 1.606 2.427 3.395 4.143 3.333 1.68-.07 2.306-1.073 4.334-1.073 2.01 0 2.6 1.073 4.348 1.034 1.8-.03 2.926-1.612 4.01-3.233a13.252 13.252 0 0 0 1.836-3.737 5.78 5.78 0 0 1-3.51-5.3z" fill="#fff"/>
            <path d="M21.465 10.483a5.895 5.895 0 0 0 1.348-4.228 6.002 6.002 0 0 0-3.882 2.01 5.617 5.617 0 0 0-1.384 4.076 4.963 4.963 0 0 0 3.918-1.858z" fill="#fff"/>
          </g>
        </g>
      </svg>

      <style jsx>{`
        @property --angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes border-spin {
          to {
            --angle: 360deg;
          }
        }
      `}</style>
    </div>
  );
}
