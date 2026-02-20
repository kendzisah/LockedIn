'use client';

import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '../lib/supabase-browser';
import type { ContentPhase, SessionDuration } from '@lockedin/shared-types';

interface SlotStatus {
  date: string;
  phase: ContentPhase;
  duration: SessionDuration;
  status: 'published' | 'draft' | 'missing';
}

interface SessionRow {
  scheduled_date: string;
  phase: string;
  duration_minutes: number;
  status: string;
}

const PHASES: ContentPhase[] = ['lock_in', 'unlock'];
const DURATIONS: SessionDuration[] = [5, 10, 15, 20];

function getNext14Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

export function CoverageKPI() {
  const [slots, setSlots] = useState<SlotStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCoverage() {
      const supabase = getBrowserSupabase();
      const days = getNext14Days();
      const startDate = days[0];
      const endDate = days[days.length - 1];

      const { data } = await supabase
        .from('scheduled_sessions')
        .select('scheduled_date, phase, duration_minutes, status')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);

      const sessions = (data ?? []) as unknown as SessionRow[];

      const allSlots: SlotStatus[] = [];
      for (const date of days) {
        for (const phase of PHASES) {
          for (const duration of DURATIONS) {
            const match = sessions.find(
              (s) =>
                s.scheduled_date === date &&
                s.phase === phase &&
                s.duration_minutes === duration,
            );
            allSlots.push({
              date,
              phase,
              duration,
              status: match
                ? (match.status as 'published' | 'draft')
                : 'missing',
            });
          }
        }
      }
      setSlots(allSlots);
      setLoading(false);
    }

    fetchCoverage();
  }, []);

  const filled = slots.filter((s) => s.status === 'published').length;
  const total = slots.length;
  const missing = slots.filter((s) => s.status === 'missing');
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-border rounded w-48 mb-2" />
        <div className="h-4 bg-border rounded w-64" />
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-6 space-y-3">
      <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
        Coverage: Next 14 days
      </h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{filled}/{total}</span>
        <span className="text-text-secondary text-sm">slots filled ({pct}%)</span>
      </div>
      {missing.length > 0 && (
        <div className="text-sm text-status-red">
          Missing:{' '}
          {missing.slice(0, 5).map((m) => (
            <span key={`${m.date}-${m.phase}-${m.duration}`} className="inline-block mr-2">
              {m.phase === 'lock_in' ? 'Lock In' : 'Unlock'} {m.duration}m {m.date.slice(5)}
            </span>
          ))}
          {missing.length > 5 && (
            <span className="text-text-secondary">+{missing.length - 5} more</span>
          )}
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <a
          href="/schedule"
          className="text-sm text-accent hover:text-accent-hover transition-colors"
        >
          View full calendar →
        </a>
      </div>
    </div>
  );
}
