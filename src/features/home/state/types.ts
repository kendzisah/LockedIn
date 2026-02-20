/**
 * Session state types for the Lock In home screen.
 *
 * Explicit state machine prevents invalid phase transitions.
 * All dates stored as local day keys (YYYY-MM-DD) in user's timezone.
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
  completedDayKeys: DayKey[]; // unique days with a completed session

  // ── Streak ──
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

  // ── Derived (cached) ──
  completedToday: boolean;

  // ── Duration from onboarding ──
  sessionDurationMinutes: number;
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
  sessionDurationMinutes: number;
}

/** All possible session actions */
export type SessionAction =
  | { type: 'HYDRATE'; payload: PersistedSessionState }
  | { type: 'SET_ANIMATING' }
  | { type: 'START_SESSION'; payload: { startTimestamp: number; expectedEndTimestamp: number; durationMinutes: number } }
  | { type: 'COMPLETE_SESSION'; payload: { durationMinutes: number } }
  | { type: 'RESET_PHASE' }
  | { type: 'SET_DURATION'; payload: number };
