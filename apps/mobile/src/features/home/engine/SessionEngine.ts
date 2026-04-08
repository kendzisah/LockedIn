/**
 * SessionEngine — Pure logic layer for Lock In sessions.
 *
 * No React dependencies. No side effects. Independently testable.
 * All day comparisons use timezone-safe local day keys (YYYY-MM-DD).
 *
 * Day key computation is delegated to ClockService (single source of truth).
 */

import type { DayKey } from '../state/types';
import { ClockService } from '../../../services/ClockService';

// ─── Day Key Helpers ─────────────────────────────────────────────

/** Returns today's date as a local day key: 'YYYY-MM-DD' (delegates to ClockService) */
export function getTodayKey(): DayKey {
  return ClockService.getLocalDateKey();
}

/** Returns yesterday's date as a local day key */
export function getYesterdayKey(): DayKey {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDayKey(d);
}

/** Format a Date to 'YYYY-MM-DD' in local timezone */
function formatDayKey(d: Date): DayKey {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Get the day key from a timestamp */
export function dayKeyFromTimestamp(ts: number): DayKey {
  return formatDayKey(new Date(ts));
}

/** Compute the number of days between two day keys (end - start) */
export function dayKeyDelta(startKey: DayKey, endKey: DayKey): number {
  const start = new Date(startKey + 'T00:00:00');
  const end = new Date(endKey + 'T00:00:00');
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// ─── Session Creation ────────────────────────────────────────────

export interface SessionTimestamps {
  startTimestamp: number;
  expectedEndTimestamp: number;
}

/** Create session timestamps for a given duration */
export function createSession(durationMinutes: number): SessionTimestamps {
  const now = Date.now();
  return {
    startTimestamp: now,
    expectedEndTimestamp: now + durationMinutes * 60 * 1000,
  };
}

/** Get remaining seconds from expected end (real-time, no interval drift) */
export function getRemaining(expectedEndTimestamp: number): number {
  return Math.max(0, Math.ceil((expectedEndTimestamp - Date.now()) / 1000));
}

// ─── Timer Phase Text ────────────────────────────────────────────

/** Deterministic Lock In phase text based on elapsed proportion */
export function getPhaseText(elapsedSeconds: number, totalSeconds: number): string {
  const ratio = elapsedSeconds / totalSeconds;

  if (ratio < 0.15) return 'Settle in. Control your breathing.';
  if (ratio < 0.35) return 'Focus sharpening.';
  if (ratio < 0.55) return 'You are doing what you said you would do.';
  if (ratio < 0.75) return 'Discipline is choosing discomfort.';
  if (ratio < 0.90) return 'Almost there. Stay locked.';
  return 'Finishing strong.';
}

// ─── Streak Calculation ──────────────────────────────────────────

/**
 * Compute the new streak value after completing a session today.
 *
 * Rules:
 * - If lastSessionDayKey === today:     keep current streak (same-day completion)
 * - If lastSessionDayKey === yesterday: streak + 1 (consecutive)
 * - Otherwise (gap or first session):   reset to 1
 */
export function computeNewStreak(
  lastSessionDayKey: DayKey | null,
  currentStreak: number,
  todayKey: DayKey,
): number {
  if (lastSessionDayKey === todayKey) {
    return currentStreak;
  }

  const yesterdayKey = getYesterdayKey();

  if (lastSessionDayKey === yesterdayKey) {
    return currentStreak + 1;
  }

  return 1;
}

