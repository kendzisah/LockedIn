/**
 * SessionEngine — Pure logic layer for Lock In sessions.
 *
 * No React dependencies. No side effects. Independently testable.
 * All day comparisons use timezone-safe local day keys (YYYY-MM-DD).
 */

import type { DayKey } from '../state/types';

// ─── Day Key Helpers ─────────────────────────────────────────────

/** Returns today's date as a local day key: 'YYYY-MM-DD' */
export function getTodayKey(): DayKey {
  const d = new Date();
  return formatDayKey(d);
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

/** Deterministic phase text based on elapsed proportion */
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
 * - If lastSessionDayKey === yesterday: streak + 1 (consecutive)
 * - If lastSessionDayKey !== yesterday (gap): reset to 1 (today = day 1)
 * - If already completed today: no change
 */
export function computeNewStreak(
  lastSessionDayKey: DayKey | null,
  currentStreak: number,
  todayKey: DayKey,
  completedDayKeys: DayKey[],
): number {
  // Already completed today — no change
  if (completedDayKeys.includes(todayKey)) {
    return currentStreak;
  }

  const yesterdayKey = getYesterdayKey();

  if (lastSessionDayKey === yesterdayKey) {
    return currentStreak + 1;
  }

  // Gap or first session ever: reset to 1
  return 1;
}

// ─── Day & Progress Calculation ──────────────────────────────────

/** Compute current day number (1-90), capped */
export function computeCurrentDay(startDayKey: DayKey | null): number {
  if (!startDayKey) return 1;
  const delta = dayKeyDelta(startDayKey, getTodayKey());
  return Math.min(90, Math.max(1, delta + 1));
}

/** Compute missed days: days elapsed (excluding today) minus completed sessions */
export function computeMissedDays(currentDay: number, completedDayKeys: DayKey[]): number {
  return Math.max(0, currentDay - 1 - completedDayKeys.length);
}

/** Compute commitment percentage */
export function computeCommitmentPercent(currentDay: number, completedDayKeys: DayKey[]): number {
  if (currentDay <= 0) return 0;
  return Math.round((completedDayKeys.length / currentDay) * 100);
}

// ─── Identity Card Messages ──────────────────────────────────────

/**
 * Deterministic identity message based on streak state.
 *
 * Priority order:
 * 1. Broke a 7+ streak → "Streak broken. Rebuild starts now."
 * 2. Missed yesterday → "Missed yesterday. Today matters."
 * 3. streak >= 7 → "Discipline compounds."
 * 4. streak 3-6 → "You are separating from average."
 * 5. streak 1-2 → "The foundation is forming."
 * 6. streak 0, had sessions → "Control is rebuilt daily."
 * 7. No sessions ever → "Control is built daily."
 */
export function getIdentityMessage(
  consecutiveStreak: number,
  longestStreak: number,
  lastSessionDayKey: DayKey | null,
  completedDayKeys: DayKey[],
  currentDay: number,
): string {
  const yesterdayKey = getYesterdayKey();
  const todayKey = getTodayKey();
  const missedYesterday =
    lastSessionDayKey !== null &&
    lastSessionDayKey !== yesterdayKey &&
    lastSessionDayKey !== todayKey;

  // First-week cap: only show limited variants for days 1-7
  const isFirstWeek = currentDay <= 7;

  // Broke a 7+ streak
  if (longestStreak >= 7 && consecutiveStreak === 0 && completedDayKeys.length > 0) {
    return 'Streak broken. Rebuild starts now.';
  }

  // Missed yesterday specifically
  if (missedYesterday && completedDayKeys.length > 0) {
    return 'Missed yesterday. Today matters.';
  }

  if (isFirstWeek) {
    if (completedDayKeys.length === 0) return 'Control is built daily.';
    if (consecutiveStreak <= 2) return 'The foundation is forming.';
    return 'You are separating from average.';
  }

  // Full variant set after first week
  if (consecutiveStreak >= 7) return 'Discipline compounds.';
  if (consecutiveStreak >= 3) return 'You are separating from average.';
  if (consecutiveStreak >= 1) return 'The foundation is forming.';
  if (completedDayKeys.length > 0) return 'Control is rebuilt daily.';
  return 'Control is built daily.';
}

// ─── Dynamic Subtext for Progress Block ──────────────────────────

export function getProgressSubtext(
  consecutiveStreak: number,
  lastSessionDayKey: DayKey | null,
): string {
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  if (lastSessionDayKey === todayKey) {
    return consecutiveStreak > 1
      ? `Streak: ${consecutiveStreak} days`
      : 'Session complete.';
  }

  if (lastSessionDayKey === yesterdayKey && consecutiveStreak > 0) {
    return `Streak: ${consecutiveStreak} days. Keep going.`;
  }

  if (lastSessionDayKey !== null) {
    return 'Streak reset. Rebuild today.';
  }

  return 'Begin your first session.';
}
