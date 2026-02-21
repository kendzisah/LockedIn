'use client';

import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '../lib/supabase-browser';
import { DayCell, type SessionSlot } from './DayCell';
import type { ContentPhase } from '@lockedin/shared-types';

interface SessionRow {
  scheduled_date: string;
  phase: ContentPhase;
  status: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PHASES: ContentPhase[] = ['lock_in', 'unlock'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday=0 offset
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function CoverageCalendar() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getMonthDays(year, month);

  const today = new Date();
  const todayStr = formatDate(today);

  const monthStart = formatDate(new Date(year, month, 1));
  const monthEnd = formatDate(new Date(year, month + 1, 0));

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from('scheduled_sessions')
        .select('scheduled_date, phase, status')
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', monthEnd);

      setSessions((data as SessionRow[]) ?? []);
      setLoading(false);
    }
    fetch();
  }, [monthStart, monthEnd]);

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function getSlotsForDate(dateStr: string): SessionSlot[] {
    return PHASES.map((phase) => {
      const match = sessions.find(
        (s) => s.scheduled_date === dateStr && s.phase === phase,
      );
      return {
        phase,
        status: match ? (match.status as 'published' | 'draft') : 'missing',
      };
    });
  }

  function handleSlotClick(date: string, phase: ContentPhase) {
    window.location.href = `/schedule?date=${date}&phase=${phase}`;
  }

  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="text-text-secondary hover:text-text-primary px-2 py-1">
          ← Prev
        </button>
        <h3 className="text-lg font-semibold">{monthLabel}</h3>
        <button onClick={nextMonth} className="text-text-secondary hover:text-text-primary px-2 py-1">
          Next →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs text-text-secondary font-medium py-1">
            {d}
          </div>
        ))}
        {days.map((day, i) =>
          day ? (
            <DayCell
              key={formatDate(day)}
              date={formatDate(day)}
              dayNumber={day.getDate()}
              isToday={formatDate(day) === todayStr}
              slots={loading ? [] : getSlotsForDate(formatDate(day))}
              onSlotClick={handleSlotClick}
            />
          ) : (
            <div key={`empty-${i}`} className="min-h-[72px]" />
          ),
        )}
      </div>

      <div className="flex gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-status-green" /> Published
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-status-gray" /> Draft
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-status-red" /> Missing
        </span>
      </div>
    </div>
  );
}
