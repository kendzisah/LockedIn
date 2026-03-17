/**
 * Session state types for the Lock In home screen.
 *
 * Explicit state machine prevents invalid phase transitions.
 * All dates stored as local day keys (YYYY-MM-DD) in user's timezone.
 *
 * Date-keyed completion: lastLockInCompletedDate / lastUnlockCompletedDate
 * prevent midnight bugs and make the AM/PM state machine deterministic.
 *
 * Program-day progression: maxCompletedDay tracks how many program days
 * have been completed (0-90). Only Lock In completion advances the day.
 */

/** Lock button / session lifecycle phases */
export type SessionPhase = 'IDLE' | 'ANIMATING' | 'ACTIVE' | 'COMPLETING';

/** Timezone-safe local date key: 'YYYY-MM-DD' */
export type DayKey = string;

/** Persisted + runtime session state */
export interface SessionState {
  phase: SessionPhase;

  // ── 90-day program (current run) ──
  programStartDate: DayKey | null;     // when this run started
  maxCompletedDay: number;             // highest program day completed (0 = none)

  // ── Streak (Lock In only, current run) ──
  lastSessionDayKey: DayKey | null;
  consecutiveStreak: number;

  // ── Lifetime stats (survive restart) ──
  lifetimeTotalMinutes: number;
  lifetimeLongestStreak: number;
  lifetimeRunsCompleted: number;       // how many 90-day programs finished

  // ── Execution Block stats (survive restart) ──
  lifetimeExecutionBlocks: number;
  lifetimeExecutionMinutes: number;

  // ── Active session (crash-resume) ──
  activeSession: {
    startTimestamp: number;
    expectedEndTimestamp: number;
    durationMinutes: number;
  } | null;

  // ── Date-keyed completion (daily CTA gating) ──
  lastLockInCompletedDate: DayKey | null;   // e.g. "2026-02-20"
  lastUnlockCompletedDate: DayKey | null;   // e.g. "2026-02-20"

  // ── Daily focus tracking ──
  dailyFocusedMinutes: number;
  dailyFocusDate: DayKey | null;

  // ── Daily goal ──
  dailyGoalMetDate: DayKey | null;

  // ── Program complete flag ──
  programCompleteSeen: boolean;
}

/** Subset of state that gets persisted to AsyncStorage */
export interface PersistedSessionState {
  // Current run
  programStartDate: DayKey | null;
  maxCompletedDay: number;
  lastSessionDayKey: DayKey | null;
  consecutiveStreak: number;

  // Lifetime
  lifetimeTotalMinutes: number;
  lifetimeLongestStreak: number;
  lifetimeRunsCompleted: number;

  // Execution Block
  lifetimeExecutionBlocks: number;
  lifetimeExecutionMinutes: number;

  // Active session
  activeSession: SessionState['activeSession'];

  // Daily gating
  lastLockInCompletedDate: DayKey | null;
  lastUnlockCompletedDate: DayKey | null;

  // Daily focus tracking
  dailyFocusedMinutes?: number;
  dailyFocusDate?: DayKey | null;

  // Daily goal
  dailyGoalMetDate?: DayKey | null;

  // Program complete
  programCompleteSeen?: boolean;

  // ── Legacy fields (for migration compat) ──
  startDayKey?: DayKey | null;
  completedDayKeys?: DayKey[];
  longestStreak?: number;
  totalMinutes?: number;
}

/** All possible session actions */
export type SessionAction =
  | { type: 'HYDRATE'; payload: PersistedSessionState }
  | { type: 'SET_ANIMATING' }
  | { type: 'START_SESSION'; payload: { startTimestamp: number; expectedEndTimestamp: number; durationMinutes: number } }
  | { type: 'UPDATE_SESSION_END'; payload: { expectedEndTimestamp: number; durationMinutes: number } }
  | { type: 'COMPLETE_SESSION'; payload: { durationMinutes: number } }
  | { type: 'COMPLETE_UNLOCK'; payload: { durationMinutes: number } }
  | { type: 'COMPLETE_EXECUTION_BLOCK'; payload: { durationMinutes: number } }
  | { type: 'ADD_DAILY_FOCUS'; payload: { minutes: number } }
  | { type: 'DAILY_GOAL_MET' }
  | { type: 'MARK_PROGRAM_SEEN' }
  | { type: 'RESET_PHASE' };
