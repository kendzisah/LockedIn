/**
 * ClockService — Single source of truth for timezone-safe date/phase logic.
 *
 * All phase determination, day key computation, and unlock window checks
 * live here to prevent drift between HomeScreen, SessionScreen, and SessionEngine.
 *
 * Uses device-local time (JavaScript Date.getHours()), which handles:
 *  - Timezone changes (always local)
 *  - DST transitions
 *  - Late-night / early-morning edge cases
 */

export type DayKey = string; // "YYYY-MM-DD"

export type CTAMode = 'lock_in' | 'unlock' | 'lock_in_done_waiting' | 'all_done';

export interface CTAState {
  mode: CTAMode;
  hint?: string;
}

const DEFAULT_UNLOCK_START_HOUR = 20; // 8 PM local
const UNLOCK_GRACE_END_HOUR = 2; // 2 AM local (next day)

/**
 * Format milliseconds remaining into a human-readable countdown string.
 * e.g. "5h 23m", "45m", "< 1m"
 */
function formatCountdown(ms: number): string {
  if (ms <= 0) return '< 1m';
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '< 1m';
}

/**
 * Returns YYYY-MM-DD in device local timezone.
 * This is the canonical "today" key used everywhere:
 * completion tracking, cache invalidation, streak checks.
 */
function getLocalDateKey(now?: Date): DayKey {
  const d = now ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if the current time is in the unlock window.
 * Default: 20:00 – 01:59 local time.
 */
function isInUnlockWindow(
  now?: Date,
  startHour: number = DEFAULT_UNLOCK_START_HOUR,
): boolean {
  const hour = (now ?? new Date()).getHours();
  return hour >= startHour || hour < UNLOCK_GRACE_END_HOUR;
}

/**
 * Determine the full CTA state for the HomeScreen.
 *
 * Logic:
 *  1. If Lock In NOT completed today → show Lock In
 *  2. If Lock In done, Unlock done → all_done
 *  3. If Lock In done, in unlock window → show Unlock
 *  4. If Lock In done, NOT in unlock window → waiting (show hint)
 */
function getCTAState(
  lastLockInDate: DayKey | null,
  lastUnlockDate: DayKey | null,
  now?: Date,
  unlockWindowStartHour: number = DEFAULT_UNLOCK_START_HOUR,
): CTAState {
  const today = getLocalDateKey(now);
  const lockInDoneToday = lastLockInDate === today;
  const unlockDoneToday = lastUnlockDate === today;

  if (!lockInDoneToday) {
    return { mode: 'lock_in' };
  }

  if (unlockDoneToday) {
    // Compute time until midnight (next Lock In)
    const d = now ?? new Date();
    const midnight = new Date(d);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - d.getTime();

    return {
      mode: 'all_done',
      hint: `Next session in ${formatCountdown(msUntilMidnight)}`,
    };
  }

  if (isInUnlockWindow(now, unlockWindowStartHour)) {
    return { mode: 'unlock' };
  }

  // Lock In done, but not yet in unlock window — countdown to 8 PM
  const d = now ?? new Date();
  const unlockTarget = new Date(d);
  unlockTarget.setHours(unlockWindowStartHour, 0, 0, 0);
  const msUntilUnlock = unlockTarget.getTime() - d.getTime();

  return {
    mode: 'lock_in_done_waiting',
    hint: `Reflect session in ${formatCountdown(msUntilUnlock)}`,
  };
}

/**
 * Get the current content phase based on completion state and time.
 * Used by SessionRepository to know which phase to prefetch.
 */
function getCurrentPhase(
  lastLockInDate: DayKey | null,
  lastUnlockDate: DayKey | null,
  unlockWindowStartHour: number = DEFAULT_UNLOCK_START_HOUR,
): 'lock_in' | 'unlock' {
  const cta = getCTAState(lastLockInDate, lastUnlockDate, undefined, unlockWindowStartHour);
  return cta.mode === 'unlock' ? 'unlock' : 'lock_in';
}

export const ClockService = {
  getLocalDateKey,
  isInUnlockWindow,
  getCTAState,
  getCurrentPhase,
};
