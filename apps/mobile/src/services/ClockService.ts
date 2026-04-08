/**
 * ClockService — Single source of truth for timezone-safe date logic.
 *
 * Uses device-local time (JavaScript Date), which handles:
 *  - Timezone changes (always local)
 *  - DST transitions
 */

export type DayKey = string; // "YYYY-MM-DD"

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

export const ClockService = {
  getLocalDateKey,
};
