'use client';

import { useEffect, useState, useCallback } from 'react';
import { getBrowserSupabase } from '../lib/supabase-browser';

// ── Types ──

interface TrackRow {
  day_number: number;
  category: string;
  title: string;
  duration_seconds: number;
  core_tenet: string | null;
}

export interface DayStatus {
  day: number;
  lockIn: { title: string; duration: number } | null;
  unlock: { title: string; duration: number } | null;
  coreTenet: string | null;
}

interface ProgramGridProps {
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
}

// ── Component ──

export function ProgramGrid({ selectedDay, onSelectDay }: ProgramGridProps) {
  const [days, setDays] = useState<DayStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDays = useCallback(async () => {
    const supabase = getBrowserSupabase();
    const { data } = await supabase
      .from('audio_tracks')
      .select('day_number, category, title, duration_seconds, core_tenet')
      .eq('is_active', true)
      .not('day_number', 'is', null)
      .order('day_number');

    const tracks = (data ?? []) as unknown as TrackRow[];

    const dayMap = new Map<number, DayStatus>();
    for (let d = 1; d <= 90; d++) {
      dayMap.set(d, { day: d, lockIn: null, unlock: null, coreTenet: null });
    }

    for (const t of tracks) {
      const entry = dayMap.get(t.day_number);
      if (!entry) continue;

      const info = { title: t.title, duration: t.duration_seconds };
      if (t.category === 'lock_in') entry.lockIn = info;
      if (t.category === 'unlock') entry.unlock = info;
      if (t.core_tenet) entry.coreTenet = t.core_tenet;
    }

    setDays(Array.from(dayMap.values()));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDays();
  }, [fetchDays]);

  // Expose refresh to parent via custom event
  useEffect(() => {
    const handler = () => fetchDays();
    window.addEventListener('program-grid-refresh', handler);
    return () => window.removeEventListener('program-grid-refresh', handler);
  }, [fetchDays]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-10 gap-1.5 animate-pulse">
          {Array.from({ length: 90 }).map((_, i) => (
            <div key={i} className="h-14 bg-surface border border-border rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">90-Day Program</h3>
        <div className="flex gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-status-green" /> Both tracks
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /> Partial
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-status-red" /> Missing
          </span>
        </div>
      </div>

      <div className="grid grid-cols-10 gap-1.5">
        {days.map((d) => {
          const hasLockIn = !!d.lockIn;
          const hasUnlock = !!d.unlock;
          const isComplete = hasLockIn && hasUnlock;
          const isPartial = (hasLockIn || hasUnlock) && !isComplete;
          const isEmpty = !hasLockIn && !hasUnlock;
          const isSelected = selectedDay === d.day;

          let borderClass = 'border-border';
          if (isSelected) borderClass = 'border-accent ring-1 ring-accent';

          let bgClass = 'bg-surface';
          if (isComplete) bgClass = 'bg-status-green/10';
          else if (isPartial) bgClass = 'bg-yellow-500/10';
          else if (isEmpty) bgClass = 'bg-status-red/5';

          return (
            <button
              key={d.day}
              onClick={() => onSelectDay(d.day)}
              className={`relative border rounded-md p-1.5 min-h-[56px] flex flex-col items-center justify-center
                         transition-all hover:border-accent/50 cursor-pointer ${borderClass} ${bgClass}`}
              title={`Day ${d.day}${d.coreTenet ? ` — ${d.coreTenet}` : ''}`}
            >
              <span className="text-xs font-medium text-text-secondary">{d.day}</span>
              <div className="flex gap-1 mt-1">
                <span
                  className={`w-2 h-2 rounded-full ${hasLockIn ? 'bg-status-green' : 'bg-status-red/40'}`}
                  title={hasLockIn ? `LI: ${d.lockIn!.title}` : 'Lock In missing'}
                />
                <span
                  className={`w-2 h-2 rounded-full ${hasUnlock ? 'bg-status-green' : 'bg-status-red/40'}`}
                  title={hasUnlock ? `UL: ${d.unlock!.title}` : 'Unlock missing'}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
