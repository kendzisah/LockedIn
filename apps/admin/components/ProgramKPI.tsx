'use client';

import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '../lib/supabase-browser';

interface TrackRow {
  day_number: number;
  category: string;
  title: string;
  duration_seconds: number;
  core_tenet: string | null;
}

interface DayCoverage {
  day: number;
  hasLockIn: boolean;
  hasUnlock: boolean;
}

export function ProgramKPI() {
  const [coverage, setCoverage] = useState<DayCoverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCoverage() {
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from('audio_tracks')
        .select('day_number, category, title, duration_seconds, core_tenet')
        .eq('is_active', true)
        .not('day_number', 'is', null)
        .order('day_number');

      const tracks = (data ?? []) as unknown as TrackRow[];

      const dayMap = new Map<number, { hasLockIn: boolean; hasUnlock: boolean }>();
      for (let d = 1; d <= 90; d++) {
        dayMap.set(d, { hasLockIn: false, hasUnlock: false });
      }

      for (const t of tracks) {
        const entry = dayMap.get(t.day_number);
        if (!entry) continue;
        if (t.category === 'lock_in') entry.hasLockIn = true;
        if (t.category === 'unlock') entry.hasUnlock = true;
      }

      const result: DayCoverage[] = [];
      for (const [day, status] of dayMap) {
        result.push({ day, ...status });
      }

      setCoverage(result);
      setLoading(false);
    }
    fetchCoverage();
  }, []);

  const totalSlots = 180; // 90 days × 2 phases
  const filledSlots = coverage.reduce(
    (acc, d) => acc + (d.hasLockIn ? 1 : 0) + (d.hasUnlock ? 1 : 0),
    0,
  );
  const completeDays = coverage.filter((d) => d.hasLockIn && d.hasUnlock).length;
  const missingLockIn = coverage.filter((d) => !d.hasLockIn);
  const missingUnlock = coverage.filter((d) => !d.hasUnlock);
  const pct = Math.round((filledSlots / totalSlots) * 100);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-border rounded w-48 mb-2" />
        <div className="h-4 bg-border rounded w-64" />
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
      <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
        90-Day Program Coverage
      </h3>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <span className="text-3xl font-bold">{completeDays}</span>
          <span className="text-text-secondary text-sm ml-1">/ 90</span>
          <p className="text-text-secondary text-xs mt-0.5">Days complete</p>
        </div>
        <div>
          <span className="text-3xl font-bold">{filledSlots}</span>
          <span className="text-text-secondary text-sm ml-1">/ {totalSlots}</span>
          <p className="text-text-secondary text-xs mt-0.5">Tracks uploaded</p>
        </div>
        <div>
          <span className="text-3xl font-bold">{pct}%</span>
          <p className="text-text-secondary text-xs mt-0.5">Coverage</p>
        </div>
      </div>

      {/* Coverage bar */}
      <div className="w-full bg-background rounded-full h-2">
        <div
          className="bg-accent h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {(missingLockIn.length > 0 || missingUnlock.length > 0) && (
        <div className="space-y-1.5 text-sm">
          {missingLockIn.length > 0 && (
            <p className="text-status-red">
              Missing Lock In:{' '}
              {missingLockIn.slice(0, 8).map((d) => `Day ${d.day}`).join(', ')}
              {missingLockIn.length > 8 && (
                <span className="text-text-secondary"> +{missingLockIn.length - 8} more</span>
              )}
            </p>
          )}
          {missingUnlock.length > 0 && (
            <p className="text-status-red">
              Missing Unlock:{' '}
              {missingUnlock.slice(0, 8).map((d) => `Day ${d.day}`).join(', ')}
              {missingUnlock.length > 8 && (
                <span className="text-text-secondary"> +{missingUnlock.length - 8} more</span>
              )}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <a
          href="/program"
          className="text-sm text-accent hover:text-accent-hover transition-colors"
        >
          Manage program →
        </a>
      </div>
    </div>
  );
}
