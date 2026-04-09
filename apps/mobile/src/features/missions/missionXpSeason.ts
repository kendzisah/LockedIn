/**
 * Global mission XP seasons: fixed 4-month calendar blocks for all users.
 * Season 1 begins January 2026; season number increments forever.
 *
 * (Separate from the 90-day Discipline Board / squad season helpers.)
 */

/** First month of Season 1 (local time): January 2026. */
const ANCHOR_YEAR = 2026;
const ANCHOR_MONTH_INDEX = 0; // January

export const KEY_MISSION_XP_SEASON = '@lockedin/mission_xp_season_number';

const MONTHS_PER_SEASON = 4;

/**
 * Current mission XP season index, starting at 1 for Jan–Apr 2026.
 * Uses the device local calendar so everyone in a timezone shares the same season.
 */
export function getMissionSeasonNumber(d: Date = new Date()): number {
  const monthsSinceAnchor =
    (d.getFullYear() - ANCHOR_YEAR) * 12 + (d.getMonth() - ANCHOR_MONTH_INDEX);
  if (monthsSinceAnchor < 0) {
    return 1;
  }
  return Math.floor(monthsSinceAnchor / MONTHS_PER_SEASON) + 1;
}

export function getMissionSeasonLabel(d: Date = new Date()): string {
  return `Season ${getMissionSeasonNumber(d)}`;
}
