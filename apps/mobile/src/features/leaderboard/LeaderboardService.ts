import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../services/SupabaseService';

export type TierType = 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Locked In Elite';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  grade: string;
  tier: TierType;
}

export interface UserRankInfo {
  rank: number;
  percentile: number;
  tier: TierType;
  score: number;
}

const TIER_THRESHOLDS = {
  'Locked In Elite': 95,
  Diamond: 80,
  Gold: 60,
  Silver: 40,
  Bronze: 0,
};

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
   * Determine tier based on score
   */
  getTier(score: number): TierType {
    if (score >= 95) return 'Locked In Elite';
    if (score >= 80) return 'Diamond';
    if (score >= 60) return 'Gold';
    if (score >= 40) return 'Silver';
    return 'Bronze';
  }

  /**
   * Submit weekly score to leaderboard
   */
  async submitWeeklyScore(
    userId: string,
    score: number,
    grade: string
  ): Promise<void> {
    try {
      const client = await this.getSupabaseClient();
      const tier = this.getTier(score);

      // Upsert: update if exists, insert if not
      const { error } = await client
        .from('leaderboard')
        .upsert(
          {
            user_id: userId,
            score,
            grade,
            tier,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        )
        .select();

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('[LeaderboardService] Error submitting score:', error);
      throw error;
    }
  }

  /**
   * Get top leaderboard entries
   */
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

      // Map to LeaderboardEntry with rank
      return (data || []).map((entry, index) => ({
        rank: index + 1,
        username: `User ${entry.user_id.substring(0, 8)}`, // Anonymous username
        score: entry.score,
        grade: entry.grade,
        tier: entry.tier as TierType,
      }));
    } catch (error) {
      console.error('[LeaderboardService] Error fetching leaderboard:', error);
      return [];
    }
  }

  /**
   * Get user's rank and percentile
   */
  async getUserRank(userId: string): Promise<UserRankInfo> {
    try {
      const client = await this.getSupabaseClient();

      // Get user's score
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
          tier: 'Bronze',
          score: 0,
        };
      }

      // Count how many users have a higher score
      const { data: higherScores, error: countError } = await client
        .from('leaderboard')
        .select('score', { count: 'exact' })
        .gt('score', userData.score);

      if (countError) {
        throw countError;
      }

      // Get total user count for percentile
      const { count: totalCount, error: totalError } = await client
        .from('leaderboard')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        throw totalError;
      }

      const usersWithHigherScore = higherScores?.length || 0;
      const rank = usersWithHigherScore + 1;
      const percentile =
        totalCount && totalCount > 0
          ? Math.round(((totalCount - rank) / totalCount) * 100)
          : 0;

      return {
        rank,
        percentile,
        tier: userData.tier as TierType,
        score: userData.score,
      };
    } catch (error) {
      console.error('[LeaderboardService] Error getting user rank:', error);
      return {
        rank: 0,
        percentile: 0,
        tier: 'Bronze',
        score: 0,
      };
    }
  }

  /**
   * Get total user count
   */
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

  /**
   * Get user's entry
   */
  async getUserEntry(userId: string): Promise<LeaderboardEntry | null> {
    try {
      const client = await this.getSupabaseClient();

      const { data, error } = await client
        .from('leaderboard')
        .select('score, grade, tier')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      const rankInfo = await this.getUserRank(userId);

      return {
        rank: rankInfo.rank,
        username: `User ${userId.substring(0, 8)}`,
        score: data.score,
        grade: data.grade,
        tier: data.tier as TierType,
      };
    } catch (error) {
      console.error('[LeaderboardService] Error getting user entry:', error);
      return null;
    }
  }

  /**
   * Clear leaderboard (for testing)
   */
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
