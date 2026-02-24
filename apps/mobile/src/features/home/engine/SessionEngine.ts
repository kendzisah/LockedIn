/**
 * SessionEngine — Pure logic layer for Lock In sessions.
 *
 * No React dependencies. No side effects. Independently testable.
 * All day comparisons use timezone-safe local day keys (YYYY-MM-DD).
 *
 * Day key computation is delegated to ClockService (single source of truth).
 *
 * Program-day progression is completion-based:
 *   - computeCurrentDay(maxCompletedDay) = maxCompletedDay + 1 (capped at 90)
 *   - Only Lock In completion advances the day
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

/** Deterministic Unlock/Reflect phase text based on elapsed proportion */
export function getUnlockPhaseText(elapsedSeconds: number, totalSeconds: number): string {
  const ratio = elapsedSeconds / totalSeconds;

  if (ratio < 0.15) return 'Let the noise settle.';
  if (ratio < 0.35) return 'Process what surfaced.';
  if (ratio < 0.55) return 'What did you overcome today?';
  if (ratio < 0.75) return 'Stillness is earned.';
  if (ratio < 0.90) return 'You showed up. Acknowledge it.';
  return 'Reflection complete.';
}

// ─── Streak Calculation ──────────────────────────────────────────

/**
 * Compute the new streak value after completing a session today.
 *
 * Rules:
 * - If lastSessionDayKey === yesterday: streak + 1 (consecutive)
 * - If lastSessionDayKey !== yesterday (gap): reset to 1 (today = day 1)
 */
export function computeNewStreak(
  lastSessionDayKey: DayKey | null,
  currentStreak: number,
  todayKey: DayKey,
): number {
  const yesterdayKey = getYesterdayKey();

  if (lastSessionDayKey === yesterdayKey) {
    return currentStreak + 1;
  }

  // Gap or first session ever: reset to 1
  return 1;
}

// ─── Day & Progress Calculation ──────────────────────────────────

/** Compute current program day (1-90). Based on completion count, not calendar. */
export function computeCurrentDay(maxCompletedDay: number): number {
  return Math.min(90, maxCompletedDay + 1);
}

/** Check if the 90-day program is complete */
export function isProgramComplete(maxCompletedDay: number): boolean {
  return maxCompletedDay >= 90;
}

/**
 * Compute commitment percentage: completed days / eligible calendar days (capped at 100%).
 *
 * Only counts today in the denominator if the user has already locked in today.
 * This prevents commitment from dropping at midnight before the user has a
 * chance to complete the day.
 */
export function computeCommitmentPercent(
  maxCompletedDay: number,
  programStartDate: DayKey | null,
  lastLockInCompletedDate: DayKey | null,
): number {
  if (!programStartDate || maxCompletedDay <= 0) return 0;

  const today = getTodayKey();
  const completedToday = lastLockInCompletedDate === today;

  // Days fully elapsed (not counting today)
  const pastDays = dayKeyDelta(programStartDate, today);

  // Include today only if the user already completed it
  const denominator = completedToday ? pastDays + 1 : Math.max(1, pastDays);

  return Math.min(100, Math.round((maxCompletedDay / denominator) * 100));
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
  maxCompletedDay: number,
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
  if (longestStreak >= 7 && consecutiveStreak === 0 && maxCompletedDay > 0) {
    return 'Streak broken. Rebuild starts now.';
  }

  // Missed yesterday specifically
  if (missedYesterday && maxCompletedDay > 0) {
    return 'Missed yesterday. Today matters.';
  }

  if (isFirstWeek) {
    if (maxCompletedDay === 0) return 'Control is built daily.';
    if (consecutiveStreak <= 2) return 'The foundation is forming.';
    return 'You are separating from average.';
  }

  // Full variant set after first week
  if (consecutiveStreak >= 7) return 'Discipline compounds.';
  if (consecutiveStreak >= 3) return 'You are separating from average.';
  if (consecutiveStreak >= 1) return 'The foundation is forming.';
  if (maxCompletedDay > 0) return 'Control is rebuilt daily.';
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
