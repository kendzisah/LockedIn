/**
 * XPService — Singleton XP awarder.
 *
 * award(eventType, payload):
 *   1. Compute XP for the event.
 *   2. Insert a row into user_xp_log.
 *   3. Bump user_stats.total_xp by the same amount.
 *
 * Returns the awarded XP (0 if Supabase auth is unavailable). Callers
 * should not retry on null — the next session will catch up via recompute.
 */

import type { XPEventType } from '@lockedin/shared-types';
import { SupabaseService } from './SupabaseService';
import { StatsService } from './StatsService';

interface SessionCompletePayload {
  durationMinutes: number;
  currentStreakDays: number;
}

interface MissionCompletePayload {
  missionId: string;
  missionXP: number;
}

interface PerfectDayPayload {
  missionsCompleted: number;
}

interface BlockResistedPayload {
  blockedAppCount: number;
}

type AwardPayload =
  | { type: 'session_complete'; data: SessionCompletePayload }
  | { type: 'mission_complete'; data: MissionCompletePayload }
  | { type: 'perfect_day'; data: PerfectDayPayload }
  | { type: 'block_resisted'; data: BlockResistedPayload }
  | { type: 'streak_bonus'; data: { streakDays: number } };

function computeXP(payload: AwardPayload): number {
  switch (payload.type) {
    case 'session_complete': {
      const { durationMinutes, currentStreakDays } = payload.data;
      const base = 35 + (durationMinutes >= 60 ? 15 : 0);
      const multiplier = 1 + Math.min(currentStreakDays / 30, 0.5);
      return Math.round(base * multiplier);
    }
    case 'mission_complete':
      return Math.max(0, payload.data.missionXP);
    case 'perfect_day':
      return 50;
    case 'block_resisted':
      return 5;
    case 'streak_bonus':
      return Math.min(100, payload.data.streakDays * 2);
  }
}

async function award(payload: AwardPayload): Promise<number> {
  const xp = computeXP(payload);
  if (xp <= 0) return 0;

  const client = SupabaseService.getClient();
  const userId = SupabaseService.getCurrentUserId();
  if (!client || !userId) return 0;

  const eventType: XPEventType = payload.type;
  const metadata: Record<string, unknown> = { ...payload.data };

  const { error: insertErr } = await client.from('user_xp_log').insert({
    user_id: userId,
    event_type: eventType,
    xp,
    metadata,
  });

  if (insertErr) {
    console.warn('[XPService] xp log insert failed:', insertErr.message);
    return 0;
  }

  await StatsService.bumpCounter('total_xp', xp);
  return xp;
}

export const XPService = {
  award,
  computeXP,
};
