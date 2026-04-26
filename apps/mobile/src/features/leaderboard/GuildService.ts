import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseService } from '../../services/SupabaseService';

const WEEK_STATS_KEY = '@lockedin/guild_week_stats';

/** Persisted flag for notification scheduling (synced from getMyGuilds). */
export const HAS_ACTIVE_GUILD_STORAGE_KEY = '@lockedin/has_active_guild';

export interface MyGuildRow {
  guild_id: string;
  name: string;
  invite_code: string;
  member_count: number;
  my_rank: number;
  my_score: number;
  top_score: number;
}

export interface GuildDetails {
  name: string;
  invite_code: string;
  owner_id: string;
  member_count: number;
  max_members: number;
  created_at: string;
}

export interface GuildLeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  rank: number;
  focus_minutes: number;
  missions_done: number;
  streak_days: number;
  total_score: number;
  is_current_user: boolean;
  /** Member's OVR snapshot from user_stats (1-99). Null if no row yet. */
  ovr: number | null;
  /** Member's RankId snapshot from user_stats. Null if no row yet. */
  rank_id: string | null;
}

export interface CreateGuildResult {
  guild_id: string;
  invite_code: string;
  name: string;
}

export interface JoinGuildResult {
  guild_id: string;
  guild_name: string;
  joined: boolean;
}

export interface WeeklyGuildStats {
  week_key: string;
  focus_minutes: number;
  missions_done: number;
  streak_days: number;
}

function formatUsername(userId: string): string {
  return `User ${userId.substring(0, 8)}`;
}

/** ISO week key from UTC clock (YYYY-Www), matching the server edge function. */
function getCurrentWeekKey(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
}

function rankFromSortedScores(sortedScores: number[], myScore: number): number {
  const idx = sortedScores.findIndex((s) => s === myScore);
  return idx === -1 ? 0 : idx + 1;
}

export const GuildService = {
  getCurrentWeekKey,

  /**
   * Updates {@link HAS_ACTIVE_GUILD_STORAGE_KEY} from the network.
   * `hadGuildBefore` reads storage before sync; use for first-guild detection.
   */
  async syncHasActiveGuildFlag(): Promise<{ hadGuildBefore: boolean; hasGuildNow: boolean }> {
    const hadGuildBefore = (await AsyncStorage.getItem(HAS_ACTIVE_GUILD_STORAGE_KEY)) === 'true';
    try {
      const guilds = await GuildService.getMyGuilds();
      const hasGuildNow = guilds.length > 0;
      await AsyncStorage.setItem(HAS_ACTIVE_GUILD_STORAGE_KEY, hasGuildNow ? 'true' : 'false');
      return { hadGuildBefore, hasGuildNow };
    } catch (e) {
      console.warn('[GuildService] syncHasActiveGuildFlag failed:', e);
      return { hadGuildBefore, hasGuildNow: hadGuildBefore };
    }
  },

  async getMyGuilds(): Promise<MyGuildRow[]> {
    try {
      const client = SupabaseService.getClient();
      const userId = SupabaseService.getCurrentUserId();
      if (!client || !userId) return [];

      const { data: memberships, error: memErr } = await client
        .from('guild_members')
        .select('guild_id')
        .eq('user_id', userId);

      if (memErr) throw memErr;
      if (!memberships?.length) return [];

      const guildIds = [...new Set(memberships.map((m) => m.guild_id as string))];

      const { data: guilds, error: guildsErr } = await client
        .from('guilds')
        .select('id, name, invite_code')
        .in('id', guildIds);

      if (guildsErr) throw guildsErr;
      if (!guilds?.length) return [];

      const weekKey = getCurrentWeekKey();

      const { data: allMembers, error: countErr } = await client
        .from('guild_members')
        .select('guild_id')
        .in('guild_id', guildIds);

      if (countErr) throw countErr;

      const memberCountByGuild = new Map<string, number>();
      for (const row of allMembers ?? []) {
        const gid = row.guild_id as string;
        memberCountByGuild.set(gid, (memberCountByGuild.get(gid) ?? 0) + 1);
      }

      const { data: weekScores, error: scoresErr } = await client
        .from('guild_scores')
        .select('guild_id, user_id, total_score')
        .in('guild_id', guildIds)
        .eq('week_key', weekKey);

      if (scoresErr) throw scoresErr;

      const scoresByGuild = new Map<string, { user_id: string; total_score: number }[]>();
      for (const row of weekScores ?? []) {
        const gid = row.guild_id as string;
        const list = scoresByGuild.get(gid) ?? [];
        list.push({
          user_id: row.user_id as string,
          total_score: Number(row.total_score ?? 0),
        });
        scoresByGuild.set(gid, list);
      }

      return guilds.map((g) => {
        const guild_id = g.id as string;
        const list = scoresByGuild.get(guild_id) ?? [];
        const sorted = [...list].sort((a, b) => b.total_score - a.total_score);
        const orderedScores = sorted.map((s) => s.total_score);
        const mine = list.find((s) => s.user_id === userId);
        const my_score = mine?.total_score ?? 0;
        const my_rank =
          mine !== undefined ? rankFromSortedScores(orderedScores, my_score) : 0;
        const top_score = orderedScores.length ? Math.max(...orderedScores) : 0;

        return {
          guild_id,
          name: g.name as string,
          invite_code: g.invite_code as string,
          member_count: memberCountByGuild.get(guild_id) ?? 0,
          my_rank,
          my_score,
          top_score,
        };
      });
    } catch (error) {
      console.error('[GuildService] getMyGuilds failed:', error);
      return [];
    }
  },

  async getGuildDetails(guildId: string): Promise<GuildDetails | null> {
    try {
      const client = SupabaseService.getClient();
      if (!client) return null;

      const { data: guild, error: guildErr } = await client
        .from('guilds')
        .select('name, invite_code, owner_id, max_members, created_at')
        .eq('id', guildId)
        .maybeSingle();

      if (guildErr) throw guildErr;
      if (!guild) return null;

      const { count, error: countErr } = await client
        .from('guild_members')
        .select('*', { count: 'exact', head: true })
        .eq('guild_id', guildId);

      if (countErr) throw countErr;

      return {
        name: guild.name as string,
        invite_code: guild.invite_code as string,
        owner_id: guild.owner_id as string,
        member_count: count ?? 0,
        max_members: Number(guild.max_members ?? 0),
        created_at: guild.created_at as string,
      };
    } catch (error) {
      console.error('[GuildService] getGuildDetails failed:', error);
      return null;
    }
  },

  async getGuildLeaderboard(
    guildId: string,
    weekKey: string
  ): Promise<GuildLeaderboardEntry[]> {
    try {
      const client = SupabaseService.getClient();
      const currentUserId = SupabaseService.getCurrentUserId();
      if (!client) return [];

      // Fetch members
      const { data: members, error: memErr } = await client
        .from('guild_members')
        .select('user_id')
        .eq('guild_id', guildId);

      if (memErr) throw memErr;
      if (!members?.length) return [];

      const memberIds = members.map((m) => m.user_id as string);

      // Fetch profiles for all members in one query
      const { data: profiles } = await client
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', memberIds);

      const profileByUser = new Map<string, { display_name: string | null; avatar_url: string | null }>();
      for (const p of profiles ?? []) {
        profileByUser.set(p.id as string, {
          display_name: p.display_name as string | null,
          avatar_url: p.avatar_url as string | null,
        });
      }

      // Fetch user_stats for OVR + rank in one query (broad-readable per RLS).
      const { data: userStats } = await client
        .from('user_stats')
        .select('user_id, ovr, rank_id')
        .in('user_id', memberIds);

      const statsByUser = new Map<string, { ovr: number; rank_id: string }>();
      for (const s of userStats ?? []) {
        statsByUser.set(s.user_id as string, {
          ovr: Number(s.ovr ?? 1),
          rank_id: (s.rank_id as string) ?? 'npc',
        });
      }

      // Fetch scores for the selected week
      const { data: scores, error: scoreErr } = await client
        .from('guild_scores')
        .select('user_id, focus_minutes, missions_done, streak_days, total_score')
        .eq('guild_id', guildId)
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

      const merged = memberIds.map((uid) => {
        const profile = profileByUser.get(uid);
        const sc = scoreByUser.get(uid);
        const us = statsByUser.get(uid);
        return {
          user_id: uid,
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          focus_minutes: sc?.focus_minutes ?? 0,
          missions_done: sc?.missions_done ?? 0,
          streak_days: sc?.streak_days ?? 0,
          total_score: sc?.total_score ?? 0,
          ovr: us?.ovr ?? null,
          rank_id: us?.rank_id ?? null,
        };
      });

      merged.sort((a, b) => b.total_score - a.total_score);

      return merged.map((row, index) => ({
        user_id: row.user_id,
        username: row.display_name || formatUsername(row.user_id),
        avatar_url: row.avatar_url,
        rank: index + 1,
        focus_minutes: row.focus_minutes,
        missions_done: row.missions_done,
        streak_days: row.streak_days,
        total_score: row.total_score,
        is_current_user: currentUserId !== null && row.user_id === currentUserId,
        ovr: row.ovr,
        rank_id: row.rank_id,
      }));
    } catch (error) {
      console.error('[GuildService] getGuildLeaderboard failed:', error);
      return [];
    }
  },

  async createGuild(name: string): Promise<CreateGuildResult | null> {
    try {
      const client = SupabaseService.getClient();
      if (!client) return null;

      const { data, error } = await client.rpc('create_guild', { guild_name: name });

      if (error) throw error;
      if (data == null || typeof data !== 'object') return null;

      const row = data as Record<string, unknown>;
      const guild_id = row.guild_id ?? row.id;
      if (typeof guild_id !== 'string') return null;

      return {
        guild_id,
        invite_code: String(row.invite_code ?? ''),
        name: String(row.name ?? name),
      };
    } catch (error) {
      console.error('[GuildService] createGuild failed:', error);
      return null;
    }
  },

  async joinGuild(code: string): Promise<JoinGuildResult | null> {
    try {
      const client = SupabaseService.getClient();
      if (!client) return null;

      const { data, error } = await client.rpc('join_guild', { code });

      if (error) throw error;
      if (data == null || typeof data !== 'object') return null;

      const row = data as Record<string, unknown>;
      const guild_id = row.guild_id;
      if (typeof guild_id !== 'string') return null;

      return {
        guild_id,
        guild_name: String(row.guild_name ?? ''),
        joined: Boolean(row.joined ?? true),
      };
    } catch (error) {
      console.error('[GuildService] joinGuild failed:', error);
      return null;
    }
  },

  async leaveGuild(guildId: string): Promise<boolean> {
    try {
      const client = SupabaseService.getClient();
      const userId = SupabaseService.getCurrentUserId();
      if (!client || !userId) return false;

      const { data: row, error: selErr } = await client
        .from('guild_members')
        .select('role')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .maybeSingle();

      if (selErr) throw selErr;
      if (!row) return false;
      if (row.role === 'owner') {
        console.warn('[GuildService] leaveGuild blocked: user is owner');
        return false;
      }

      const { error: delErr } = await client
        .from('guild_members')
        .delete()
        .eq('guild_id', guildId)
        .eq('user_id', userId);

      if (delErr) throw delErr;
      return true;
    } catch (error) {
      console.error('[GuildService] leaveGuild failed:', error);
      return false;
    }
  },

  async kickMember(guildId: string, targetUserId: string): Promise<boolean> {
    try {
      const client = SupabaseService.getClient();
      if (!client) return false;

      const { error } = await client.rpc('kick_guild_member', {
        target_guild_id: guildId,
        target_user_id: targetUserId,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[GuildService] kickMember failed:', error);
      return false;
    }
  },

  async deleteGuild(guildId: string): Promise<boolean> {
    try {
      const client = SupabaseService.getClient();
      const userId = SupabaseService.getCurrentUserId();
      if (!client || !userId) return false;

      const { error } = await client
        .from('guilds')
        .delete()
        .eq('id', guildId)
        .eq('owner_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[GuildService] deleteGuild failed:', error);
      return false;
    }
  },

  async getWeeklyStats(): Promise<WeeklyGuildStats> {
    const currentWeek = getCurrentWeekKey();
    const empty = (): WeeklyGuildStats => ({
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

      const parsed = JSON.parse(raw) as Partial<WeeklyGuildStats>;
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
      console.error('[GuildService] getWeeklyStats failed:', error);
      return empty();
    }
  },

  async updateWeeklyStats(stats: Partial<WeeklyGuildStats>): Promise<void> {
    try {
      const currentWeek = getCurrentWeekKey();
      const existing = await GuildService.getWeeklyStats();
      const next: WeeklyGuildStats = {
        week_key: currentWeek,
        focus_minutes: stats.focus_minutes ?? existing.focus_minutes,
        missions_done: stats.missions_done ?? existing.missions_done,
        streak_days: stats.streak_days ?? existing.streak_days,
      };
      await AsyncStorage.setItem(WEEK_STATS_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('[GuildService] updateWeeklyStats failed:', error);
    }
  },

  /**
   * Submit a mission completion through the server-side Edge Function.
   * Upserts guild_scores for each guild via `upsert_guild_score` RPC.
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

      const { data, error } = await client.functions.invoke('complete-mission', {
        body: { timeGate, focusMinutes, missionsDone, streakDays },
      });

      if (error) {
        const message = error.message ?? '';
        if (message.includes('time_gate_locked') || (data && data.error === 'time_gate_locked')) {
          return { success: false, error: 'time_gate_locked' };
        }
        throw error;
      }

      return { success: true };
    } catch (err) {
      console.warn('[GuildService] Edge function failed:', err);
      return { success: false, error: 'network_error' };
    }
  },
};
