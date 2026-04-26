/**
 * RankService — Pure rank computation. No I/O.
 *
 * Mirrors the SQL CASE in 00011_user_stats.sql so JS-side rank previews
 * (Home status bar, Session-complete overlay) stay consistent with the
 * recomputed value the DB writes after a session.
 */

import type { RankId } from '@lockedin/shared-types';
import { RANK_BY_ID, RANK_TIERS, type RankTier } from '../design/rankTiers';

function rankFromStreak(currentStreakDays: number): RankTier {
  // RANK_TIERS is ordered ascending by minDays; walk down to find the highest match.
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (currentStreakDays >= RANK_TIERS[i].minDays) {
      return RANK_TIERS[i];
    }
  }
  return RANK_TIERS[0];
}

function rankById(id: RankId): RankTier {
  return RANK_BY_ID[id];
}

function nextRank(currentStreakDays: number): RankTier | null {
  const current = rankFromStreak(currentStreakDays);
  const idx = RANK_TIERS.findIndex((t) => t.id === current.id);
  return idx >= 0 && idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;
}

function progressToNext(currentStreakDays: number): number {
  const current = rankFromStreak(currentStreakDays);
  const next = nextRank(currentStreakDays);
  if (!next) return 1;
  const span = next.minDays - current.minDays;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (currentStreakDays - current.minDays) / span));
}

interface RankChange {
  direction: 'up' | 'down';
  from: RankTier;
  to: RankTier;
}

function detectRankChange(prevStreakDays: number, nextStreakDays: number): RankChange | null {
  const from = rankFromStreak(prevStreakDays);
  const to = rankFromStreak(nextStreakDays);
  if (from.id === to.id) return null;
  return {
    direction: nextStreakDays > prevStreakDays ? 'up' : 'down',
    from,
    to,
  };
}

export const RankService = {
  rankFromStreak,
  rankById,
  nextRank,
  progressToNext,
  detectRankChange,
};
