import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../services/SupabaseService';
import { isLockedInMissionEligible } from './seasonMissionConsistency';

/**
 * Discipline Board tiers (seasonal 0–100 score). Top tier "Locked In" also requires
 * ≥90% perfect mission days (81/90) in the current 90-day season — see seasonMissionConsistency.
 */
export const DISCIPLINE_TIERS = [
  'Recruit',
  'Soldier',
  'Vet',
  'OG',
  'Elite',
  'Legend',
  'Goat',
  'Immortal',
  'Locked In',
] as const;

export type DisciplineTier = (typeof DISCIPLINE_TIERS)[number];

/** @deprecated Use DisciplineTier; kept for existing imports */
export type TierType = DisciplineTier;

const LOCKED_IN_SCORE_MIN = 88;

/** Minimum score (0–100) for each non–Locked In tier (ascending). Locked In uses score + mission rule. */
const SCORE_FLOOR: Record<Exclude<DisciplineTier, 'Locked In'>, number> = {
  Recruit: 0,
  Soldier: 11,
  Vet: 22,
  OG: 33,
  Elite: 44,
  Legend: 55,
  Goat: 66,
  Immortal: 77,
};

/**
 * Resolve tier from weekly/seasonal performance score. "Locked In" additionally requires
 * mission consistency in the season (handled by caller via lockedInMissionEligible).
 */
/** Short label for the circular tier badge (2 chars max where needed). */
export function disciplineTierBadgeShort(tier: DisciplineTier): string {
  const m: Record<DisciplineTier, string> = {
    Recruit: 'R',
    Soldier: 'S',
    Vet: 'V',
    OG: 'OG',
    Elite: 'E',
    Legend: 'Le',
    Goat: 'G',
    Immortal: 'Im',
    'Locked In': 'LI',
  };
  return m[tier];
}

export function resolveDisciplineTier(
  score: number,
  lockedInMissionEligible: boolean,
): DisciplineTier {
  const s = Math.min(100, Math.max(0, score));

  if (s >= LOCKED_IN_SCORE_MIN && lockedInMissionEligible) {
    return 'Locked In';
  }

  if (s >= SCORE_FLOOR.Immortal) return 'Immortal';
  if (s >= SCORE_FLOOR.Goat) return 'Goat';
  if (s >= SCORE_FLOOR.Legend) return 'Legend';
  if (s >= SCORE_FLOOR.Elite) return 'Elite';
  if (s >= SCORE_FLOOR.OG) return 'OG';
  if (s >= SCORE_FLOOR.Vet) return 'Vet';
  if (s >= SCORE_FLOOR.Soldier) return 'Soldier';
  return 'Recruit';
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  score: number;
  grade: string;
  tier: DisciplineTier;
}

export interface UserRankInfo {
  rank: number;
  percentile: number;
  tier: DisciplineTier;
  score: number;
}

class LeaderboardService {
  private supabase: SupabaseClient | null = null;

  private async getSupabaseClient(): Promise<SupabaseClient> {
    if (!this.supabase) {
      this.supabase = SupabaseService.getClient() ?? null;
    }
    if (!this.supabase) throw new Error('Supabase client not initialized');
    return this.supabase;
  }

  /**
   * @deprecated Use resolveDisciplineTier — kept for call sites that only have score.
   */
  getTier(score: number): DisciplineTier {
    return resolveDisciplineTier(score, false);
  }

  /**
   * Submit seasonal score to leaderboard (tier should match resolveDisciplineTier on server).
   */
  async submitWeeklyScore(
    userId: string,
    score: number,
    grade: string,
    lockedInMissionEligible?: boolean,
  ): Promise<void> {
    try {
      const client = await this.getSupabaseClient();
      const tier = resolveDisciplineTier(score, lockedInMissionEligible ?? false);

      const { error } = await client.from('leaderboard').upsert(
        {
          user_id: userId,
          score,
          grade,
          tier,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        },
      );

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('[LeaderboardService] Error submitting score:', error);
      throw error;
    }
  }

  async getLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
    try {
      const client = await this.getSupabaseClient();

      const { data, error } = await client
        .from('leaderboard')
        .select('user_id, score, grade, tier')
        .order('score', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data || []).map((entry, index) => {
        const score = Number(entry.score);
        return {
          rank: index + 1,
          user_id: entry.user_id,
          username: `User ${entry.user_id.substring(0, 8)}`,
          score,
          grade: entry.grade,
          // Other users: score only (Locked In requires per-user mission data not on leaderboard rows yet).
          tier: resolveDisciplineTier(score, false),
        };
      });
    } catch (error) {
      console.error('[LeaderboardService] Error fetching leaderboard:', error);
      return [];
    }
  }

  async getUserRank(userId: string): Promise<UserRankInfo> {
    try {
      const client = await this.getSupabaseClient();
      const lockedInEligible = await isLockedInMissionEligible();

      const { data: userData, error: userError } = await client
        .from('leaderboard')
        .select('score, grade, tier')
        .eq('user_id', userId)
        .single();

      if (userError || !userData) {
        console.warn('[LeaderboardService] User not found on leaderboard');
        return {
          rank: 0,
          percentile: 0,
          tier: 'Recruit',
          score: 0,
        };
      }

      const score = Number(userData.score);
      const tier = resolveDisciplineTier(score, lockedInEligible);

      const { count: higherCount, error: countError } = await client
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .gt('score', score);

      if (countError) {
        throw countError;
      }

      const { count: totalCount, error: totalError } = await client
        .from('leaderboard')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        throw totalError;
      }

      const usersWithHigherScore = higherCount ?? 0;
      const rank = usersWithHigherScore + 1;
      const percentile =
        totalCount && totalCount > 0
          ? Math.round(((totalCount - rank) / totalCount) * 100)
          : 0;

      return {
        rank,
        percentile,
        tier,
        score,
      };
    } catch (error) {
      console.error('[LeaderboardService] Error getting user rank:', error);
      return {
        rank: 0,
        percentile: 0,
        tier: 'Recruit',
        score: 0,
      };
    }
  }

  async getTotalUsers(): Promise<number> {
    try {
      const client = await this.getSupabaseClient();

      const { count, error } = await client
        .from('leaderboard')
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      console.error('[LeaderboardService] Error getting total users:', error);
      return 0;
    }
  }

  async getUserEntry(userId: string): Promise<LeaderboardEntry | null> {
    try {
      const client = await this.getSupabaseClient();
      const lockedInEligible = await isLockedInMissionEligible();

      const { data, error } = await client
        .from('leaderboard')
        .select('score, grade, tier')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      const rankInfo = await this.getUserRank(userId);
      const score = Number(data.score);
      const tier = resolveDisciplineTier(score, lockedInEligible);

      return {
        rank: rankInfo.rank,
        user_id: userId,
        username: `User ${userId.substring(0, 8)}`,
        score,
        grade: data.grade,
        tier,
      };
    } catch (error) {
      console.error('[LeaderboardService] Error getting user entry:', error);
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      const client = await this.getSupabaseClient();
      await client.from('leaderboard').delete().neq('user_id', '');
    } catch (error) {
      console.error('[LeaderboardService] Error clearing leaderboard:', error);
    }
  }
}

export default new LeaderboardService();
