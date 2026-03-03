export const metadata = {
  title: 'Terms of Service — LockedIn',
  description: 'Terms of Service for Locked In: Mental Conditioning',
};

const h2 = 'text-xl font-semibold text-text-primary mt-10 mb-3';
const p = 'text-sm leading-relaxed text-text-secondary mb-3';
const ul = 'list-disc list-inside text-sm text-text-secondary space-y-1 mb-3 pl-2';

export default function TermsPage() {
  return (
    <article className="max-w-3xl mx-auto pb-20">
      <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-1">
        Terms of Service
      </h1>
      <p className="text-xs text-text-secondary mb-10">Last Updated: March 2, 2026</p>

      <p className={p}>
        Welcome to Locked In: Mental Conditioning (&ldquo;Locked In,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;). These Terms of Service (&ldquo;Terms&rdquo;)
        govern your use of the Locked In mobile application and related services (the
        &ldquo;Service&rdquo;).
      </p>
      <p className={p}>
        By downloading, accessing, or using the Service, you agree to be bound by these Terms. If
        you do not agree, do not use the Service.
      </p>

      {/* ── Eligibility ── */}
      <h2 className={h2}>Eligibility</h2>
      <p className={p}>
        You must be at least 13 years old (or the minimum age required in your jurisdiction) to use
        the Service. By using the Service, you represent that you meet this requirement.
      </p>

      {/* ── Description of Service ── */}
      <h2 className={h2}>Description of Service</h2>
      <p className={p}>
        Locked In is a structured mental conditioning and performance-focused application designed
        to help users build discipline, focus, and consistency through guided sessions and optional
        device restriction tools.
      </p>
      <p className={p}>The Service may include:</p>
      <ul className={ul}>
        <li>Guided &ldquo;Lock In&rdquo; and &ldquo;Reflect&rdquo; sessions</li>
        <li>Focus and distraction-limiting tools</li>
        <li>Streak tracking and performance metrics</li>
        <li>Goal-setting features</li>
      </ul>
      <p className={p}>The Service is not medical, psychological, or therapeutic treatment.</p>

      {/* ── No Medical or Mental Health Advice ── */}
      <h2 className={h2}>No Medical or Mental Health Advice</h2>
      <p className={p}>
        Locked In is not a substitute for professional medical, psychological, or psychiatric care.
        The content provided is for educational and personal development purposes only.
      </p>
      <p className={p}>
        If you are experiencing mental health challenges, emotional distress, or crisis, seek
        assistance from a qualified professional immediately.
      </p>

      {/* ── Subscriptions and Payments ── */}
      <h2 className={h2}>Subscriptions and Payments</h2>
      <p className={p}>Certain features require a paid subscription.</p>
      <ul className={ul}>
        <li>
          Subscriptions may be offered on a weekly, monthly, or annual basis and may include
          introductory trial periods.
        </li>
        <li>
          Payment will be charged to your Apple ID account at confirmation of purchase.
        </li>
        <li>
          Subscriptions automatically renew unless canceled at least 24 hours before the end of the
          current billing period.
        </li>
        <li>
          You may manage or cancel your subscription through your Apple ID account settings.
        </li>
        <li>
          We do not issue refunds for unused portions of subscription periods except where required
          by law.
        </li>
      </ul>

      {/* ── Free Trials ── */}
      <h2 className={h2}>Free Trials</h2>
      <p className={p}>
        If offered, free trial eligibility is determined by Apple and may be limited to new
        subscribers. After the trial period ends, your subscription will automatically renew at the
        applicable rate unless canceled prior to renewal.
      </p>

      {/* ── Execution Block and Device Restrictions ── */}
      <h2 className={h2}>Execution Block and Device Restrictions</h2>
      <p className={p}>
        Certain features may request permission to use device-level APIs (such as Screen Time or
        similar frameworks) to limit access to selected applications during user-initiated focus
        sessions.
      </p>
      <p className={p}>By enabling these features, you acknowledge:</p>
      <ul className={ul}>
        <li>You voluntarily activate device restrictions.</li>
        <li>You are responsible for managing permissions granted to the Service.</li>
        <li>We are not liable for disruptions caused by enabled restrictions.</li>
      </ul>
      <p className={p}>
        You may revoke permissions at any time through your device settings.
      </p>

      {/* ── User Conduct ── */}
      <h2 className={h2}>User Conduct</h2>
      <p className={p}>You agree not to:</p>
      <ul className={ul}>
        <li>Use the Service for unlawful purposes</li>
        <li>Attempt to reverse engineer or interfere with the Service</li>
        <li>Exploit or misuse the Service in a way that harms other users</li>
      </ul>
      <p className={p}>
        We reserve the right to suspend or terminate accounts that violate these Terms.
      </p>

      {/* ── Intellectual Property ── */}
      <h2 className={h2}>Intellectual Property</h2>
      <p className={p}>
        All content, branding, session scripts, design elements, and functionality within Locked In
        are the intellectual property of the company and are protected by applicable copyright and
        trademark laws.
      </p>
      <p className={p}>
        You may not copy, distribute, or reproduce any portion of the Service without prior written
        consent.
      </p>

      {/* ── Disclaimer of Warranties ── */}
      <h2 className={h2}>Disclaimer of Warranties</h2>
      <p className={p}>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
        warranties of any kind, express or implied.
      </p>
      <p className={p}>We do not guarantee that:</p>
      <ul className={ul}>
        <li>The Service will be uninterrupted or error-free</li>
        <li>Results will be achieved from use of the Service</li>
        <li>The Service will meet your specific expectations</li>
      </ul>

      {/* ── Limitation of Liability ── */}
      <h2 className={h2}>Limitation of Liability</h2>
      <p className={p}>
        To the fullest extent permitted by law, Locked In shall not be liable for indirect,
        incidental, consequential, or punitive damages arising from your use of the Service.
      </p>
      <p className={p}>Your use of the Service is at your own risk.</p>

      {/* ── Termination ── */}
      <h2 className={h2}>Termination</h2>
      <p className={p}>
        We reserve the right to suspend or terminate access to the Service at our discretion if you
        violate these Terms.
      </p>
      <p className={p}>You may stop using the Service at any time.</p>

      {/* ── Changes to Terms ── */}
      <h2 className={h2}>Changes to Terms</h2>
      <p className={p}>
        We may update these Terms from time to time. Continued use of the Service after changes are
        posted constitutes acceptance of the revised Terms.
      </p>

      {/* ── Governing Law ── */}
      <h2 className={h2}>Governing Law</h2>
      <p className={p}>
        These Terms shall be governed by the laws of the jurisdiction in which the company is
        registered, without regard to conflict of law principles.
      </p>

      {/* ── Contact Information ── */}
      <h2 className={h2}>Contact Information</h2>
      <p className={p}>If you have questions about these Terms, contact:</p>
      <p className={p}>
        Flock Technologies Inc.
        <br />
        <a href="mailto:support@flock.flights" className="text-accent hover:text-accent-hover transition-colors">
          support@flock.flights
        </a>
      </p>
    </article>
  );
}
