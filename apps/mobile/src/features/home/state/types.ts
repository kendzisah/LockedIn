/**
 * Session state types for the Lock In home screen.
 *
 * All dates stored as local day keys (YYYY-MM-DD) in user's timezone.
 * maxCompletedDay tracks total days with at least one execution block.
 */

/** Lock button lifecycle phases */
export type SessionPhase = 'IDLE' | 'ANIMATING';

/** Timezone-safe local date key: 'YYYY-MM-DD' */
export type DayKey = string;

/** Persisted + runtime session state */
export interface SessionState {
  phase: SessionPhase;

  // ── Program tracking ──
  programStartDate: DayKey | null;
  maxCompletedDay: number;

  // ── Streak ──
  lastSessionDayKey: DayKey | null;
  consecutiveStreak: number;

  // ── Lifetime stats ──
  lifetimeTotalMinutes: number;
  lifetimeLongestStreak: number;
  lifetimeRunsCompleted: number;

  // ── Execution Block stats ──
  lifetimeExecutionBlocks: number;
  lifetimeExecutionMinutes: number;

  // ── Date-keyed completion ──
  lastLockInCompletedDate: DayKey | null;

  // ── Daily focus tracking ──
  dailyFocusedMinutes: number;
  dailyFocusDate: DayKey | null;

  // ── Daily goal ──
  dailyGoalMetDate: DayKey | null;

  // ── Weekly completion history (day keys where daily goal was met) ──
  weekCompletedDays: DayKey[];
}

/** Subset of state that gets persisted to AsyncStorage */
export interface PersistedSessionState {
  programStartDate: DayKey | null;
  maxCompletedDay: number;
  lastSessionDayKey: DayKey | null;
  consecutiveStreak: number;

  lifetimeTotalMinutes: number;
  lifetimeLongestStreak: number;
  lifetimeRunsCompleted: number;

  lifetimeExecutionBlocks: number;
  lifetimeExecutionMinutes: number;

  // Legacy fields (kept for migration)
  activeSession?: { startTimestamp: number; expectedEndTimestamp: number; durationMinutes: number } | null;
  lastUnlockCompletedDate?: DayKey | null;
  programCompleteSeen?: boolean;

  lastLockInCompletedDate: DayKey | null;

  dailyFocusedMinutes?: number;
  dailyFocusDate?: DayKey | null;
  dailyGoalMetDate?: DayKey | null;
  weekCompletedDays?: DayKey[];

  // Legacy migration fields
  startDayKey?: DayKey | null;
  completedDayKeys?: DayKey[];
  longestStreak?: number;
  totalMinutes?: number;
}

/** All possible session actions */
export type SessionAction =
  | { type: 'HYDRATE'; payload: PersistedSessionState }
  | { type: 'SET_ANIMATING' }
  | { type: 'COMPLETE_EXECUTION_BLOCK'; payload: { durationMinutes: number } }
  | { type: 'ADD_DAILY_FOCUS'; payload: { minutes: number } }
  | { type: 'DAILY_GOAL_MET' }
  | { type: 'RESET_PHASE' }
  | { type: 'FULL_RESET' };
