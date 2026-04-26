// ── Stats / OVR / Rank — shared across mobile + admin ──

export type Stat =
  | 'discipline'
  | 'focus'
  | 'execution'
  | 'consistency'
  | 'social';

export type RankId =
  | 'npc'
  | 'grinder'
  | 'rising'
  | 'chosen'
  | 'elite'
  | 'phantom'
  | 'legend'
  | 'goat'
  | 'locked_in';

export type XPEventType =
  | 'session_complete'
  | 'mission_complete'
  | 'perfect_day'
  | 'block_resisted'
  | 'streak_bonus';

export type CounterField =
  | 'total_focus_minutes'
  | 'total_sessions'
  | 'total_completed_sessions'
  | 'total_blocked_attempts'
  | 'total_distractions_resisted'
  | 'total_missions_completed'
  | 'total_perfect_days'
  | 'total_streak_days'
  | 'invites_used'
  | 'guild_check_ins'
  | 'total_xp';

export interface UserStatsRow {
  user_id: string;

  // Counters
  total_focus_minutes: number;
  total_sessions: number;
  total_completed_sessions: number;
  total_blocked_attempts: number;
  total_distractions_resisted: number;
  total_missions_completed: number;
  total_perfect_days: number;
  total_streak_days: number;
  invites_used: number;
  guild_check_ins: number;
  total_xp: number;

  // Stateful
  current_streak_days: number;
  longest_streak_days: number;

  // Derived
  discipline: number;
  focus: number;
  execution: number;
  consistency: number;
  social: number;
  ovr: number;
  rank_id: RankId;

  updated_at: string;
}

export interface XPLogRow {
  id: string;
  user_id: string;
  event_type: XPEventType;
  xp: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AchievementRow {
  user_id: string;
  achievement_id: string;
  earned_at: string;
  metadata: Record<string, unknown>;
}
