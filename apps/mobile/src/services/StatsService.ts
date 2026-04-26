/**
 * StatsService — Singleton wrapper around user_stats table.
 *
 * Atomic counter bumps via the `bump_user_stat` RPC; derived stats are
 * recomputed via `recompute_user_stats` (mirrors the formula in
 * 00011_user_stats.sql). All methods no-op silently if Supabase is not
 * authenticated ("timer-only mode" — same pattern as GuildService).
 */

import type {
  CounterField,
  RankId,
  Stat,
  UserStatsRow,
} from '@lockedin/shared-types';
import { SupabaseService } from './SupabaseService';

type Listener = (snapshot: UserStatsRow) => void;

let cached: UserStatsRow | null = null;
const listeners = new Set<Listener>();

function notify(next: UserStatsRow) {
  cached = next;
  for (const fn of listeners) {
    try {
      fn(next);
    } catch (e) {
      console.warn('[StatsService] listener threw:', e);
    }
  }
}

async function fetchOnce(): Promise<UserStatsRow | null> {
  const client = SupabaseService.getClient();
  const userId = SupabaseService.getCurrentUserId();
  if (!client || !userId) return null;

  const { data, error } = await client
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[StatsService] fetchOnce failed:', error.message);
    return null;
  }
  return (data as UserStatsRow) ?? null;
}

async function refresh(): Promise<UserStatsRow | null> {
  const row = await fetchOnce();
  if (row) notify(row);
  return row;
}

async function bumpCounter(field: CounterField, delta: number): Promise<void> {
  if (delta === 0) return;
  const client = SupabaseService.getClient();
  if (!client) return;

  const { error } = await client.rpc('bump_user_stat', {
    p_field: field,
    p_delta: delta,
  });
  if (error) {
    console.warn(`[StatsService] bumpCounter(${field}, ${delta}) failed:`, error.message);
  }
}

async function setStreak(currentStreakDays: number): Promise<void> {
  const client = SupabaseService.getClient();
  if (!client) return;

  const { error } = await client.rpc('set_user_streak', {
    p_current_streak_days: currentStreakDays,
  });
  if (error) {
    console.warn('[StatsService] setStreak failed:', error.message);
  }
}

interface RecomputeResult {
  discipline: number;
  focus: number;
  execution: number;
  consistency: number;
  social: number;
  ovr: number;
  rank_id: RankId;
}

async function recompute(): Promise<RecomputeResult | null> {
  const client = SupabaseService.getClient();
  if (!client) return null;

  const { data, error } = await client.rpc('recompute_user_stats');
  if (error) {
    console.warn('[StatsService] recompute failed:', error.message);
    return null;
  }
  // RPC returns SETOF; take the first row.
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) return null;

  // Refresh cache + notify listeners with the full row
  await refresh();
  return result as RecomputeResult;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (cached) listener(cached);
  return () => {
    listeners.delete(listener);
  };
}

function getCached(): UserStatsRow | null {
  return cached;
}

function statValue(row: UserStatsRow | null, stat: Stat): number {
  if (!row) return 1;
  return row[stat] ?? 1;
}

export const StatsService = {
  refresh,
  bumpCounter,
  setStreak,
  recompute,
  subscribe,
  getCached,
  statValue,
};
