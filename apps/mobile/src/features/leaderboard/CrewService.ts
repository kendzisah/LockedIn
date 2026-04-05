import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseService } from '../../services/SupabaseService';
import { ENV } from '../../config/env';

const WEEK_STATS_KEY = '@lockedin/crew_week_stats';

/** Persisted flag for notification scheduling (synced from getMyCrews). */
export const HAS_ACTIVE_CREW_STORAGE_KEY = '@lockedin/has_active_crew';

export interface MyCrewRow {
  crew_id: string;
  name: string;
  invite_code: string;
  member_count: number;
  my_rank: number;
  my_score: number;
  top_score: number;
}

export interface CrewDetails {
  name: string;
  invite_code: string;
  owner_id: string;
  member_count: number;
  max_members: number;
  created_at: string;
}

export interface CrewLeaderboardEntry {
  user_id: string;
  username: string;
  rank: number;
  focus_minutes: number;
  missions_done: number;
  streak_days: number;
  total_score: number;
  is_current_user: boolean;
}

export interface CreateCrewResult {
  crew_id: string;
  invite_code: string;
  name: string;
}

export interface JoinCrewResult {
  crew_id: string;
  crew_name: string;
  joined: boolean;
}

export interface WeeklyCrewStats {
  week_key: string;
  focus_minutes: number;
  missions_done: number;
  streak_days: number;
}

function formatUsername(userId: string): string {
  return `User ${userId.substring(0, 8)}`;
}

/** ISO week key from the device local calendar (YYYY-Www), e.g. '2026-W14'. */
function getCurrentWeekKey(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const isoYear = d.getFullYear();
  const yearStart = new Date(isoYear, 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
}

function computeTotalScore(
  focusMinutes: number,
  missionsDone: number,
  streakDays: number
): number {
  return focusMinutes * 2 + missionsDone * 15 + streakDays * 10;
}

function rankFromSortedScores(sortedScores: number[], myScore: number): number {
  const idx = sortedScores.findIndex((s) => s === myScore);
  return idx === -1 ? 0 : idx + 1;
}

async function submitScoreInternal(
  crewId: string,
  focusMinutes: number,
  missionsDone: number,
  streakDays: number
): Promise<boolean> {
  try {
    const client = SupabaseService.getClient();
    const userId = SupabaseService.getCurrentUserId();
    if (!client || !userId) return false;

    const weekKey = getCurrentWeekKey();
    const total_score = computeTotalScore(focusMinutes, missionsDone, streakDays);

    const { error } = await client.from('crew_scores').upsert(
      {
        crew_id: crewId,
        user_id: userId,
        week_key: weekKey,
        focus_minutes: focusMinutes,
        missions_done: missionsDone,
        streak_days: streakDays,
        total_score,
      },
      { onConflict: 'crew_id,user_id,week_key' }
    );

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[CrewService] submitScore failed:', error);
    return false;
  }
}

export const CrewService = {
  getCurrentWeekKey,

  /**
   * Updates {@link HAS_ACTIVE_CREW_STORAGE_KEY} from the network.
   * `hadCrewBefore` reads storage before sync; use for first-crew detection.
   */
  async syncHasActiveCrewFlag(): Promise<{ hadCrewBefore: boolean; hasCrewNow: boolean }> {
    const hadCrewBefore = (await AsyncStorage.getItem(HAS_ACTIVE_CREW_STORAGE_KEY)) === 'true';
    try {
      const crews = await CrewService.getMyCrews();
      const hasCrewNow = crews.length > 0;
      await AsyncStorage.setItem(HAS_ACTIVE_CREW_STORAGE_KEY, hasCrewNow ? 'true' : 'false');
      return { hadCrewBefore, hasCrewNow };
    } catch {
      return { hadCrewBefore, hasCrewNow: hadCrewBefore };
    }
  },

  async getMyCrews(): Promise<MyCrewRow[]> {
    try {
      const client = SupabaseService.getClient();
      const userId = SupabaseService.getCurrentUserId();
      if (!client || !userId) return [];

      const { data: memberships, error: memErr } = await client
        .from('crew_members')
        .select('crew_id')
        .eq('user_id', userId);

      if (memErr) throw memErr;
      if (!memberships?.length) return [];

      const crewIds = [...new Set(memberships.map((m) => m.crew_id as string))];

      const { data: crews, error: crewsErr } = await client
        .from('crews')
        .select('id, name, invite_code')
        .in('id', crewIds);

      if (crewsErr) throw crewsErr;
      if (!crews?.length) return [];

      const weekKey = getCurrentWeekKey();

      const { data: allMembers, error: countErr } = await client
        .from('crew_members')
        .select('crew_id')
        .in('crew_id', crewIds);

      if (countErr) throw countErr;

      const memberCountByCrew = new Map<string, number>();
      for (const row of allMembers ?? []) {
        const cid = row.crew_id as string;
        memberCountByCrew.set(cid, (memberCountByCrew.get(cid) ?? 0) + 1);
      }

      const { data: weekScores, error: scoresErr } = await client
        .from('crew_scores')
        .select('crew_id, user_id, total_score')
        .in('crew_id', crewIds)
        .eq('week_key', weekKey);

      if (scoresErr) throw scoresErr;

      const scoresByCrew = new Map<string, { user_id: string; total_score: number }[]>();
      for (const row of weekScores ?? []) {
        const cid = row.crew_id as string;
        const list = scoresByCrew.get(cid) ?? [];
        list.push({
          user_id: row.user_id as string,
          total_score: Number(row.total_score ?? 0),
        });
        scoresByCrew.set(cid, list);
      }

      return crews.map((c) => {
        const crew_id = c.id as string;
        const list = scoresByCrew.get(crew_id) ?? [];
        const sorted = [...list].sort((a, b) => b.total_score - a.total_score);
        const orderedScores = sorted.map((s) => s.total_score);
        const mine = list.find((s) => s.user_id === userId);
        const my_score = mine?.total_score ?? 0;
        const my_rank =
          mine !== undefined ? rankFromSortedScores(orderedScores, my_score) : 0;
        const top_score = orderedScores.length ? Math.max(...orderedScores) : 0;

        return {
          crew_id,
          name: c.name as string,
          invite_code: c.invite_code as string,
          member_count: memberCountByCrew.get(crew_id) ?? 0,
          my_rank,
          my_score,
          top_score,
        };
      });
    } catch (error) {
      console.error('[CrewService] getMyCrews failed:', error);
      return [];
    }
  },

  async getCrewDetails(crewId: string): Promise<CrewDetails | null> {
    try {
      const client = SupabaseService.getClient();
      if (!client) return null;

      const { data: crew, error: crewErr } = await client
        .from('crews')
        .select('name, invite_code, owner_id, max_members, created_at')
        .eq('id', crewId)
        .maybeSingle();

      if (crewErr) throw crewErr;
      if (!crew) return null;

      const { count, error: countErr } = await client
        .from('crew_members')
        .select('*', { count: 'exact', head: true })
        .eq('crew_id', crewId);

      if (countErr) throw countErr;

      return {
        name: crew.name as string,
        invite_code: crew.invite_code as string,
        owner_id: crew.owner_id as string,
        member_count: count ?? 0,
        max_members: Number(crew.max_members ?? 0),
        created_at: crew.created_at as string,
      };
    } catch (error) {
      console.error('[CrewService] getCrewDetails failed:', error);
      return null;
    }
  },

  async getCrewLeaderboard(
    crewId: string,
    weekKey: string
  ): Promise<CrewLeaderboardEntry[]> {
    try {
      const client = SupabaseService.getClient();
      const currentUserId = SupabaseService.getCurrentUserId();
      if (!client) return [];

      const { data: members, error: memErr } = await client
        .from('crew_members')
        .select('user_id')
        .eq('crew_id', crewId);

      if (memErr) throw memErr;
      if (!members?.length) return [];

      const { data: scores, error: scoreErr } = await client
        .from('crew_scores')
        .select('user_id, focus_minutes, missions_done, streak_days, total_score')
        .eq('crew_id', crewId)
        .eq('week_key', weekKey);

      if (scoreErr) throw scoreErr;

      const scoreByUser = new Map<
        string,
        { focus_minutes: number; missions_done: number; streak_days: number; total_score: number }
      >();
      for (const s of scores ?? []) {
        scoreByUser.set(s.user_id as string, {
          focus_minutes: Number(s.focus_minutes ?? 0),
          missions_done: Number(s.missions_done ?? 0),
          streak_days: Number(s.streak_days ?? 0),
          total_score: Number(s.total_score ?? 0),
        });
      }

      const merged = members.map((m) => {
        const uid = m.user_id as string;
        const sc = scoreByUser.get(uid);
        return {
          user_id: uid,
          focus_minutes: sc?.focus_minutes ?? 0,
          missions_done: sc?.missions_done ?? 0,
          streak_days: sc?.streak_days ?? 0,
          total_score: sc?.total_score ?? 0,
        };
      });

      merged.sort((a, b) => b.total_score - a.total_score);

      return merged.map((row, index) => ({
        user_id: row.user_id,
        username: formatUsername(row.user_id),
        rank: index + 1,
        focus_minutes: row.focus_minutes,
        missions_done: row.missions_done,
        streak_days: row.streak_days,
        total_score: row.total_score,
        is_current_user: currentUserId !== null && row.user_id === currentUserId,
      }));
    } catch (error) {
      console.error('[CrewService] getCrewLeaderboard failed:', error);
      return [];
    }
  },

  async createCrew(name: string): Promise<CreateCrewResult | null> {
    try {
      const client = SupabaseService.getClient();
      if (!client) return null;

      const { data, error } = await client.rpc('create_crew', { crew_name: name });

      if (error) throw error;
      if (data == null || typeof data !== 'object') return null;

      const row = data as Record<string, unknown>;
      const crew_id = row.crew_id ?? row.id;
      if (typeof crew_id !== 'string') return null;

      return {
        crew_id,
        invite_code: String(row.invite_code ?? ''),
        name: String(row.name ?? name),
      };
    } catch (error) {
      console.error('[CrewService] createCrew failed:', error);
      return null;
    }
  },

  async joinCrew(code: string): Promise<JoinCrewResult | null> {
    try {
      const client = SupabaseService.getClient();
      if (!client) return null;

      const { data, error } = await client.rpc('join_crew', { code });

      if (error) throw error;
      if (data == null || typeof data !== 'object') return null;

      const row = data as Record<string, unknown>;
      const crew_id = row.crew_id;
      if (typeof crew_id !== 'string') return null;

      return {
        crew_id,
        crew_name: String(row.crew_name ?? ''),
        joined: Boolean(row.joined ?? true),
      };
    } catch (error) {
      console.error('[CrewService] joinCrew failed:', error);
      return null;
    }
  },

  async leaveCrew(crewId: string): Promise<boolean> {
    try {
      const client = SupabaseService.getClient();
      const userId = SupabaseService.getCurrentUserId();
      if (!client || !userId) return false;

      const { data: row, error: selErr } = await client
        .from('crew_members')
        .select('role')
        .eq('crew_id', crewId)
        .eq('user_id', userId)
        .maybeSingle();

      if (selErr) throw selErr;
      if (!row) return false;
      if (row.role === 'owner') {
        console.warn('[CrewService] leaveCrew blocked: user is owner');
        return false;
      }

      const { error: delErr } = await client
        .from('crew_members')
        .delete()
        .eq('crew_id', crewId)
        .eq('user_id', userId);

      if (delErr) throw delErr;
      return true;
    } catch (error) {
      console.error('[CrewService] leaveCrew failed:', error);
      return false;
    }
  },

  async kickMember(crewId: string, targetUserId: string): Promise<boolean> {
    try {
      const client = SupabaseService.getClient();
      if (!client) return false;

      const { error } = await client.rpc('kick_crew_member', {
        target_crew_id: crewId,
        target_user_id: targetUserId,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[CrewService] kickMember failed:', error);
      return false;
    }
  },

  async deleteCrew(crewId: string): Promise<boolean> {
    try {
      const client = SupabaseService.getClient();
      const userId = SupabaseService.getCurrentUserId();
      if (!client || !userId) return false;

      const { error } = await client
        .from('crews')
        .delete()
        .eq('id', crewId)
        .eq('owner_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[CrewService] deleteCrew failed:', error);
      return false;
    }
  },

  submitScore(
    crewId: string,
    focusMinutes: number,
    missionsDone: number,
    streakDays: number
  ): Promise<boolean> {
    return submitScoreInternal(crewId, focusMinutes, missionsDone, streakDays);
  },

  async submitScoreToAllCrews(
    focusMinutes: number,
    missionsDone: number,
    streakDays: number
  ): Promise<void> {
    try {
      const client = SupabaseService.getClient();
      const userId = SupabaseService.getCurrentUserId();
      if (!client || !userId) return;

      const { data: memberships, error } = await client
        .from('crew_members')
        .select('crew_id')
        .eq('user_id', userId);

      if (error) throw error;

      for (const m of memberships ?? []) {
        try {
          const ok = await submitScoreInternal(
            m.crew_id as string,
            focusMinutes,
            missionsDone,
            streakDays
          );
          if (!ok) {
            console.error('[CrewService] submitScoreToAllCrews: submit failed for crew', m.crew_id);
          }
        } catch (err) {
          console.error('[CrewService] submitScoreToAllCrews crew error:', m.crew_id, err);
        }
      }
    } catch (error) {
      console.error('[CrewService] submitScoreToAllCrews failed:', error);
    }
  },

  async getWeeklyStats(): Promise<WeeklyCrewStats> {
    const currentWeek = getCurrentWeekKey();
    const empty = (): WeeklyCrewStats => ({
      week_key: currentWeek,
      focus_minutes: 0,
      missions_done: 0,
      streak_days: 0,
    });

    try {
      const raw = await AsyncStorage.getItem(WEEK_STATS_KEY);
      if (!raw) {
        const initial = empty();
        await AsyncStorage.setItem(WEEK_STATS_KEY, JSON.stringify(initial));
        return initial;
      }

      const parsed = JSON.parse(raw) as Partial<WeeklyCrewStats>;
      if (
        typeof parsed.week_key !== 'string' ||
        typeof parsed.focus_minutes !== 'number' ||
        typeof parsed.missions_done !== 'number' ||
        typeof parsed.streak_days !== 'number'
      ) {
        const reset = empty();
        await AsyncStorage.setItem(WEEK_STATS_KEY, JSON.stringify(reset));
        return reset;
      }

      if (parsed.week_key !== currentWeek) {
        const reset = empty();
        await AsyncStorage.setItem(WEEK_STATS_KEY, JSON.stringify(reset));
        return reset;
      }

      return {
        week_key: parsed.week_key,
        focus_minutes: parsed.focus_minutes,
        missions_done: parsed.missions_done,
        streak_days: parsed.streak_days,
      };
    } catch (error) {
      console.error('[CrewService] getWeeklyStats failed:', error);
      return empty();
    }
  },

  async updateWeeklyStats(stats: Partial<WeeklyCrewStats>): Promise<void> {
    try {
      const currentWeek = getCurrentWeekKey();
      const existing = await CrewService.getWeeklyStats();
      const next: WeeklyCrewStats = {
        week_key: currentWeek,
        focus_minutes: stats.focus_minutes ?? existing.focus_minutes,
        missions_done: stats.missions_done ?? existing.missions_done,
        streak_days: stats.streak_days ?? existing.streak_days,
      };
      await AsyncStorage.setItem(WEEK_STATS_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('[CrewService] updateWeeklyStats failed:', error);
    }
  },

  /**
   * Submit a mission completion through the server-side Edge Function.
   * The server validates the time gate against its own clock and upserts crew_scores.
   * Falls back to client-side upsert if the Edge Function is unreachable.
   */
  async completeMissionServerSide(
    timeGate: string | undefined,
    focusMinutes: number,
    missionsDone: number,
    streakDays: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const client = SupabaseService.getClient();
      if (!client) return { success: false, error: 'Client not initialized' };

      const { data: { session } } = await client.auth.getSession();
      if (!session?.access_token) return { success: false, error: 'No session' };

      const utcOffsetMinutes = new Date().getTimezoneOffset() * -1;

      const res = await fetch(`${ENV.SUPABASE_URL}/functions/v1/complete-mission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          timeGate,
          utcOffsetMinutes,
          focusMinutes,
          missionsDone,
          streakDays,
        }),
      });

      if (res.status === 403) {
        const body = await res.json();
        return { success: false, error: body.error ?? 'time_gate_locked' };
      }

      if (!res.ok) {
        throw new Error(`Edge function returned ${res.status}`);
      }

      return { success: true };
    } catch (err) {
      console.warn('[CrewService] Edge function failed, falling back to client upsert:', err);
      // Fallback: submit directly (no time-gate enforcement, but keeps scores working)
      await CrewService.submitScoreToAllCrews(focusMinutes, missionsDone, streakDays);
      return { success: true };
    }
  },
};
