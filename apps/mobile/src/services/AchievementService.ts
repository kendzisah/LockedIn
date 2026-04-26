/**
 * AchievementService — Singleton achievement evaluator.
 *
 * evaluate(snapshot):
 *   1. Loads the user's already-earned ids (cached after first call).
 *   2. Walks ACHIEVEMENT_CATALOG; any whose condition is true and that
 *      isn't already earned is inserted into user_achievements.
 *   3. Fires `Achievement Unlocked` analytics for each new id.
 *
 * Returns the list of newly-earned achievement ids.
 */

import type { UserStatsRow } from '@lockedin/shared-types';
import { SupabaseService } from './SupabaseService';
import { Analytics } from './AnalyticsService';
import { ACHIEVEMENT_BY_ID, ACHIEVEMENT_CATALOG } from './achievementCatalog';

let earnedCache: Set<string> | null = null;

async function loadEarned(): Promise<Set<string>> {
  if (earnedCache) return earnedCache;
  const client = SupabaseService.getClient();
  const userId = SupabaseService.getCurrentUserId();
  if (!client || !userId) {
    earnedCache = new Set();
    return earnedCache;
  }

  const { data, error } = await client
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId);

  if (error) {
    console.warn('[AchievementService] loadEarned failed:', error.message);
    return new Set();
  }

  earnedCache = new Set((data ?? []).map((r: { achievement_id: string }) => r.achievement_id));
  return earnedCache;
}

async function evaluate(snapshot: UserStatsRow | null): Promise<string[]> {
  if (!snapshot) return [];
  const client = SupabaseService.getClient();
  const userId = SupabaseService.getCurrentUserId();
  if (!client || !userId) return [];

  const earned = await loadEarned();
  const toAward: string[] = [];

  for (const a of ACHIEVEMENT_CATALOG) {
    if (earned.has(a.id)) continue;
    if (a.condition(snapshot)) toAward.push(a.id);
  }

  if (toAward.length === 0) return [];

  const rows = toAward.map((id) => ({
    user_id: userId,
    achievement_id: id,
    metadata: { stats_snapshot_ovr: snapshot.ovr },
  }));

  const { error } = await client.from('user_achievements').insert(rows);
  if (error) {
    console.warn('[AchievementService] insert failed:', error.message);
    return [];
  }

  for (const id of toAward) {
    earned.add(id);
    const a = ACHIEVEMENT_BY_ID[id];
    if (a) {
      Analytics.track('Achievement Unlocked', {
        achievement_id: a.id,
        achievement_name: a.name,
        achievement_category: a.category,
        ovr: snapshot.ovr,
      });
    }
  }

  return toAward;
}

function reset(): void {
  earnedCache = null;
}

export const AchievementService = {
  evaluate,
  reset,
};
