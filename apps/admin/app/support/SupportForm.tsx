'use client';

import { useState, type FormEvent } from 'react';

const FORMSPREE_URL = 'https://formspree.io/f/mbdjvzkb';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function SupportForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        setStatus('success');
        form.reset();
      } else {
        const json = await res.json().catch(() => null);
        setErrorMsg(json?.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-status-green/30 bg-status-green/5 px-5 py-6 text-center mb-10">
        <p className="text-sm font-medium text-status-green mb-1">
          Message sent successfully.
        </p>
        <p className="text-xs text-text-secondary">
          We&apos;ll get back to you as soon as possible.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-4 text-xs text-accent hover:text-accent-hover transition-colors"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-10">
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-text-secondary mb-1.5">
          Email Address
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          placeholder="you@example.com"
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 outline-none transition-colors focus:border-accent"
        />
      </div>

      <div>
        <label htmlFor="subject" className="block text-xs font-medium text-text-secondary mb-1.5">
          Subject
        </label>
        <select
          id="subject"
          name="subject"
          required
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
        >
          <option value="">Select a topic</option>
          <option value="Subscription / Billing">Subscription / Billing</option>
          <option value="Account Issue">Account Issue</option>
          <option value="Bug Report">Bug Report</option>
          <option value="Feature Request">Feature Request</option>
          <option value="General Question">General Question</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="block text-xs font-medium text-text-secondary mb-1.5">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="Describe your issue or question..."
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 outline-none transition-colors focus:border-accent resize-none"
        />
      </div>

      {status === 'error' && (
        <p className="text-xs text-status-red">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
