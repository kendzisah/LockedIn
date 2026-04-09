'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Check Your Email</h2>
          <p className="text-text-secondary text-sm">
            If an account exists for <span className="text-text-primary font-medium">{email}</span>,
            we sent a link to reset your password.
          </p>
          <Link
            href="/admin"
            className="inline-block text-sm text-accent hover:text-accent-hover transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Forgot Password</h2>
          <p className="text-text-secondary text-sm mt-1">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-surface border border-border rounded-md text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-status-red text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-accent hover:bg-accent-hover text-white font-medium
                       rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <div className="text-center">
            <Link
              href="/admin"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
