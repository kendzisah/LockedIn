/**
 * Rank progression — 9 tiers driven by current_streak_days.
 *
 * Mirrors the SQL CASE in 00011_user_stats.sql `recompute_user_stats()`.
 * Colors reuse the existing streakTiers palette for visual continuity.
 */

import type { RankId } from '@lockedin/shared-types';

export interface RankTier {
  id: RankId;
  name: string;
  minDays: number;
  color: string;
}

export const RANK_TIERS: RankTier[] = [
  { id: 'npc',       name: 'NPC',       minDays: 0,   color: '#8B8B8B' },
  { id: 'grinder',   name: 'RECRUIT',   minDays: 3,   color: '#4A7FB5' },
  { id: 'rising',    name: 'RISING',    minDays: 7,   color: '#00C2FF' },
  { id: 'chosen',    name: 'CHOSEN',    minDays: 14,  color: '#00D68F' },
  { id: 'elite',     name: 'ELITE',     minDays: 30,  color: '#FFC857' },
  { id: 'phantom',   name: 'PHANTOM',   minDays: 60,  color: '#FF4757' },
  { id: 'legend',    name: 'LEGEND',    minDays: 90,  color: '#A855F7' },
  { id: 'goat',      name: 'GOAT',      minDays: 180, color: '#E0E7FF' },
  { id: 'locked_in', name: 'LOCKED IN', minDays: 365, color: '#FF006E' },
];

export const RANK_BY_ID: Record<RankId, RankTier> = RANK_TIERS.reduce(
  (acc, tier) => {
    acc[tier.id] = tier;
    return acc;
  },
  {} as Record<RankId, RankTier>,
);
