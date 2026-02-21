/**
 * Session state types for the Lock In home screen.
 *
 * Explicit state machine prevents invalid phase transitions.
 * All dates stored as local day keys (YYYY-MM-DD) in user's timezone.
 *
 * Date-keyed completion: lastLockInCompletedDate / lastUnlockCompletedDate
 * prevent midnight bugs and make the AM/PM state machine deterministic.
 */

/** Lock button / session lifecycle phases */
export type SessionPhase = 'IDLE' | 'ANIMATING' | 'ACTIVE' | 'COMPLETING';

/** Timezone-safe local date key: 'YYYY-MM-DD' */
export type DayKey = string;

/** Persisted + runtime session state */
export interface SessionState {
  phase: SessionPhase;

  // ── 90-day program ──
  startDayKey: DayKey | null;
  completedDayKeys: DayKey[]; // unique days with a completed Lock In session

  // ── Streak (Lock In only) ──
  lastSessionDayKey: DayKey | null;
  consecutiveStreak: number;
  longestStreak: number;

  // ── Lifetime ──
  totalMinutes: number;

  // ── Active session (crash-resume) ──
  activeSession: {
    startTimestamp: number;
    expectedEndTimestamp: number;
    durationMinutes: number;
  } | null;

  // ── Date-keyed completion (replaces completedToday boolean) ──
  lastLockInCompletedDate: DayKey | null;   // e.g. "2026-02-20"
  lastUnlockCompletedDate: DayKey | null;   // e.g. "2026-02-20"

}

/** Subset of state that gets persisted to AsyncStorage */
export interface PersistedSessionState {
  startDayKey: DayKey | null;
  completedDayKeys: DayKey[];
  lastSessionDayKey: DayKey | null;
  consecutiveStreak: number;
  longestStreak: number;
  totalMinutes: number;
  activeSession: SessionState['activeSession'];
  lastLockInCompletedDate: DayKey | null;
  lastUnlockCompletedDate: DayKey | null;
}

/** All possible session actions */
export type SessionAction =
  | { type: 'HYDRATE'; payload: PersistedSessionState }
  | { type: 'SET_ANIMATING' }
  | { type: 'START_SESSION'; payload: { startTimestamp: number; expectedEndTimestamp: number; durationMinutes: number } }
  | { type: 'COMPLETE_SESSION'; payload: { durationMinutes: number } }
  | { type: 'COMPLETE_UNLOCK'; payload: { durationMinutes: number } }
  | { type: 'RESET_PHASE' };
