import { SupportForm } from './SupportForm';

export const metadata = {
  title: 'Support — LockedIn',
  description: 'Get help with Locked In: Mental Conditioning',
};

const h2 = 'text-xl font-semibold text-text-primary mt-10 mb-3';
const p = 'text-sm leading-relaxed text-text-secondary mb-3';

const FAQ = [
  {
    q: 'How do I restore my subscription on a new device?',
    a: 'Open the app and the paywall will appear automatically. Tap "Restore Purchases" at the bottom. Your subscription is tied to your Apple ID, so it will be recognized on any device signed into the same account.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Subscriptions are managed through Apple. Go to Settings → Your Name → Subscriptions → Locked In → Cancel. You will retain access until the end of your current billing period.',
  },
  {
    q: 'What happens if I miss a Lock In session?',
    a: 'Your streak resets to zero. However, your overall program progress (day count) is preserved. You can continue where you left off the next day.',
  },
  {
    q: 'Can I use the app on multiple devices?',
    a: 'Yes. Your subscription works on any device signed into the same Apple ID. Session progress is stored locally on each device.',
  },
  {
    q: 'How does the Execution Block work?',
    a: 'The Execution Block locks down your phone for a duration you choose, helping you focus on a task. You can activate it unlimited times per day. Hold the lock icon for 2 seconds to end early.',
  },
  {
    q: 'What is the 90-day program?',
    a: 'The program consists of daily Lock In (morning) and Reflect (evening) sessions over 90 days. Each session is approximately 5 minutes of guided audio designed to build discipline and self-accountability.',
  },
  {
    q: 'My audio is not playing during sessions.',
    a: 'Make sure your device is not in silent mode and the volume is turned up. If the issue persists, try force-closing and reopening the app.',
  },
];

export default function SupportPage() {
  return (
    <article className="max-w-3xl mx-auto pb-20">
      <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-1">
        Support
      </h1>
      <p className="text-xs text-text-secondary mb-10">
        Locked In: Mental Conditioning
      </p>

      <p className={p}>
        Need help with Locked In? Check the frequently asked questions below or
        send us a message using the contact form.
      </p>

      {/* ── FAQ ── */}
      <h2 className={h2}>Frequently Asked Questions</h2>

      <div className="space-y-4 mb-10">
        {FAQ.map(({ q, a }) => (
          <details
            key={q}
            className="group rounded-lg border border-border bg-surface px-5 py-4"
          >
            <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-text-primary">
              {q}
              <svg
                className="ml-3 h-4 w-4 shrink-0 text-text-secondary transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              {a}
            </p>
          </details>
        ))}
      </div>

      {/* ── Contact Form ── */}
      <h2 className={h2}>Contact Us</h2>
      <p className={p}>
        If your question isn&apos;t answered above, send us a message and
        we&apos;ll get back to you as soon as possible.
      </p>

      <SupportForm />

      {/* ── Additional Info ── */}
      <h2 className={h2}>Additional Resources</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="https://locked-in.co/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg border border-border bg-surface px-5 py-4 transition-colors hover:border-accent"
        >
          <h3 className="text-sm font-medium text-text-primary mb-1">Privacy Policy</h3>
          <p className="text-xs text-text-secondary">
            Learn how we handle your data.
          </p>
        </a>

        <a
          href="https://apps.apple.com/account/subscriptions"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg border border-border bg-surface px-5 py-4 transition-colors hover:border-accent"
        >
          <h3 className="text-sm font-medium text-text-primary mb-1">Manage Subscription</h3>
          <p className="text-xs text-text-secondary">
            View or cancel your subscription via Apple.
          </p>
        </a>
      </div>
    </article>
  );
}
