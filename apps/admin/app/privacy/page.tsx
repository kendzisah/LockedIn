export const metadata = {
  title: 'Privacy Policy — LockedIn',
  description: 'Privacy Policy for Locked In: Mental Conditioning',
};

/* ── Reusable styles ── */
const h2 = 'text-xl font-semibold text-text-primary mt-10 mb-3';
const h3 = 'text-base font-semibold text-text-primary mt-6 mb-2';
const p = 'text-sm leading-relaxed text-text-secondary mb-3';
const ul = 'list-disc list-inside text-sm text-text-secondary space-y-1 mb-3 pl-2';

export default function PrivacyPolicyPage() {
  return (
    <article className="max-w-3xl mx-auto pb-20">
      <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-1">
        Privacy Policy
      </h1>
      <p className="text-xs text-text-secondary mb-10">Last Updated: February 22, 2026</p>

      <p className={p}>
        Locked In: Mental Conditioning (&ldquo;Locked In&rdquo;, &ldquo;we&rdquo;,
        &ldquo;our&rdquo;, or &ldquo;us&rdquo;) respects your privacy. This Privacy Policy
        explains what information we collect, how we use it, and your rights regarding that
        information.
      </p>
      <p className={p}>
        By using Locked In, you agree to the practices described in this policy.
      </p>

      {/* ── 1 ── */}
      <h2 className={h2}>1. Information We Collect</h2>

      <h3 className={h3}>A. Account &amp; Authentication Data</h3>
      <p className={p}>
        Locked In uses anonymous authentication through Supabase. We may collect:
      </p>
      <ul className={ul}>
        <li>Anonymous user ID</li>
        <li>Device-generated authentication tokens</li>
        <li>Timezone (to deliver daily sessions correctly)</li>
      </ul>
      <p className={p}>We do not require your name or email to use the app.</p>

      <h3 className={h3}>B. Usage Data</h3>
      <p className={p}>
        We collect limited usage information to operate the app and improve performance:
      </p>
      <ul className={ul}>
        <li>Session start and completion timestamps</li>
        <li>Duration selected (5, 10, 15, 20 minutes)</li>
        <li>Lock In completion date (for streak tracking)</li>
        <li>Unlock/Reflect completion date</li>
        <li>Basic app events (e.g., audio load success/failure)</li>
      </ul>
      <p className={p}>We do not record or store audio from your device.</p>

      <h3 className={h3}>C. Subscription &amp; Payment Data</h3>
      <p className={p}>Payments are processed through Apple&apos;s App Store.</p>
      <p className={p}>We do not collect or store:</p>
      <ul className={ul}>
        <li>Credit card numbers</li>
        <li>Billing addresses</li>
        <li>Financial details</li>
      </ul>
      <p className={p}>
        We may receive confirmation of subscription status from Apple to determine access to
        premium features.
      </p>

      <h3 className={h3}>D. Device Information</h3>
      <p className={p}>We may collect limited technical information:</p>
      <ul className={ul}>
        <li>Device type</li>
        <li>Operating system version</li>
        <li>App version</li>
        <li>Crash reports</li>
      </ul>
      <p className={p}>This data is used for stability and debugging.</p>

      <h3 className={h3}>E. Audio Content</h3>
      <p className={p}>
        The app streams pre-recorded audio sessions from our secure servers.
      </p>
      <p className={p}>We do not:</p>
      <ul className={ul}>
        <li>Record your microphone</li>
        <li>Monitor your phone usage outside the app</li>
        <li>Access personal files or other applications</li>
      </ul>

      {/* ── 2 ── */}
      <h2 className={h2}>2. How We Use Your Information</h2>
      <p className={p}>We use collected data to:</p>
      <ul className={ul}>
        <li>Deliver the correct daily Lock In and Reflect sessions</li>
        <li>Track streaks and progress metrics</li>
        <li>Improve performance and reliability</li>
        <li>Maintain app security</li>
        <li>Enforce subscription access</li>
      </ul>
      <p className={`${p} font-semibold text-text-primary`}>
        We do not sell your personal data.
      </p>

      {/* ── 3 ── */}
      <h2 className={h2}>3. Data Storage &amp; Security</h2>
      <p className={p}>
        Audio files and session metadata are stored securely using Supabase infrastructure.
      </p>
      <p className={p}>We use:</p>
      <ul className={ul}>
        <li>Secure HTTPS connections</li>
        <li>Authentication tokens</li>
        <li>Row-level security policies</li>
        <li>Time-limited signed URLs for audio streaming</li>
      </ul>
      <p className={p}>
        We take reasonable measures to protect your information. However, no system is completely
        secure.
      </p>

      {/* ── 4 ── */}
      <h2 className={h2}>4. Data Retention</h2>
      <p className={p}>We retain:</p>
      <ul className={ul}>
        <li>Anonymous user session data for as long as your account exists</li>
        <li>Session completion logs for streak calculation</li>
      </ul>
      <p className={p}>
        If you uninstall the app without linking an account, your anonymous data may be permanently
        lost.
      </p>

      {/* ── 5 ── */}
      <h2 className={h2}>5. Third-Party Services</h2>
      <p className={p}>Locked In relies on:</p>
      <ul className={ul}>
        <li>Supabase (authentication and database)</li>
        <li>Apple App Store (payments)</li>
        <li>Expo / React Native services (app infrastructure)</li>
        <li>ElevenLabs (audio generation, internal use only)</li>
      </ul>
      <p className={p}>
        These providers may process limited technical data necessary for service operation.
      </p>
      <p className={`${p} font-semibold text-text-primary`}>
        We do not share your usage data with advertisers.
      </p>

      {/* ── 6 ── */}
      <h2 className={h2}>6. Children&apos;s Privacy</h2>
      <p className={p}>
        Locked In is not intended for children under 13 years old.
      </p>
      <p className={p}>We do not knowingly collect data from children.</p>

      {/* ── 7 ── */}
      <h2 className={h2}>7. Your Rights</h2>
      <p className={p}>
        Depending on your jurisdiction, you may have the right to:
      </p>
      <ul className={ul}>
        <li>Request deletion of your data</li>
        <li>Request access to your stored information</li>
        <li>Request correction of inaccurate data</li>
      </ul>
      <p className={p}>
        To exercise these rights, contact us at:{' '}
        <span className="text-text-primary">[Insert Contact Email]</span>
      </p>

      {/* ── 8 ── */}
      <h2 className={h2}>8. International Users</h2>
      <p className={p}>
        Your data may be processed in countries outside your own. By using the app, you consent to
        this transfer.
      </p>

      {/* ── 9 ── */}
      <h2 className={h2}>9. Changes to This Policy</h2>
      <p className={p}>
        We may update this Privacy Policy periodically. Updates will be posted in-app or on our
        website with a revised date.
      </p>

      {/* ── 10 ── */}
      <h2 className={h2}>10. Contact</h2>
      <p className={p}>
        If you have questions about this Privacy Policy, contact:
      </p>
      <p className={p}>
        <strong className="text-text-primary">Locked In: Mental Conditioning</strong>
        <br />
        Email: <span className="text-text-primary">[Insert Support Email]</span>
      </p>
    </article>
  );
}
