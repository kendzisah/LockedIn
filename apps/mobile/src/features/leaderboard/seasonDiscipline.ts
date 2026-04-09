/**
 * Discipline Board seasons: 90-day periods (≈3 months). Leaderboard scores reset each season.
 */

export const SEASON_LENGTH_DAYS = 90;

/** Anchor for deterministic season indexing (UTC midnight). */
const SEASON_ANCHOR_UTC_MS = Date.UTC(2025, 0, 1);

export function getSeasonIndex(nowMs: number = Date.now()): number {
  const daysSinceAnchor = Math.floor((nowMs - SEASON_ANCHOR_UTC_MS) / 86_400_000);
  return Math.floor(Math.max(0, daysSinceAnchor) / SEASON_LENGTH_DAYS);
}

/** Stable id for the current 90-day season, e.g. "S0", "S1", … */
export function getCurrentSeasonId(nowMs: number = Date.now()): string {
  return `S${getSeasonIndex(nowMs)}`;
}

/** 1-based day index within the current 90-day season. */
export function getDayOfSeason(nowMs: number = Date.now()): number {
  const daysSinceAnchor = Math.floor((nowMs - SEASON_ANCHOR_UTC_MS) / 86_400_000);
  return (daysSinceAnchor % SEASON_LENGTH_DAYS) + 1;
}

/** Days counted so far this season (for consistency rate denominators). */
export function getSeasonDaysElapsed(nowMs: number = Date.now()): number {
  return Math.min(SEASON_LENGTH_DAYS, getDayOfSeason(nowMs));
}
