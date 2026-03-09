/**
 * SessionProvider — Global session state with persistence and crash-resume.
 *
 * Phase transitions enforced: IDLE -> ANIMATING -> ACTIVE -> COMPLETING -> IDLE
 * Invalid transitions are no-ops.
 *
 * Program-day progression:
 *   - maxCompletedDay tracks how many program days finished (0-90)
 *   - Only Lock In (COMPLETE_SESSION) increments maxCompletedDay
 *   - Unlock (COMPLETE_UNLOCK) adds listening time but does NOT advance the day
 *
 * Lifetime vs current-run:
 *   - lifetimeTotalMinutes / lifetimeLongestStreak / lifetimeRunsCompleted survive restart
 *   - maxCompletedDay / consecutiveStreak / programStartDate reset on RESET_PROGRAM
 *
 * HYDRATE handles legacy shapes (startDayKey, completedDayKeys, etc.) for migration.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  SessionState,
  SessionAction,
  PersistedSessionState,
} from './types';
import { getTodayKey, computeNewStreak } from '../engine/SessionEngine';

// ─── Constants ───────────────────────────────────────────────────

const STORAGE_KEY = '@lockedin/session_state';

// ─── Initial State ───────────────────────────────────────────────

const initialState: SessionState = {
  phase: 'IDLE',
  programStartDate: null,
  maxCompletedDay: 0,
  lastSessionDayKey: null,
  consecutiveStreak: 0,
  lifetimeTotalMinutes: 0,
  lifetimeLongestStreak: 0,
  lifetimeRunsCompleted: 0,
  lifetimeExecutionBlocks: 0,
  lifetimeExecutionMinutes: 0,
  activeSession: null,
  lastLockInCompletedDate: null,
  lastUnlockCompletedDate: null,
};

// ─── Reducer ─────────────────────────────────────────────────────

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'HYDRATE': {
      const p = action.payload;

      // Migration: old state used startDayKey / completedDayKeys / totalMinutes / longestStreak
      const migratedMaxDay = p.maxCompletedDay ?? (p.completedDayKeys ? new Set(p.completedDayKeys).size : 0);
      const migratedStartDate = p.programStartDate ?? p.startDayKey ?? null;
      const migratedLifetimeMinutes = p.lifetimeTotalMinutes ?? p.totalMinutes ?? 0;
      const migratedLifetimeLongest = p.lifetimeLongestStreak ?? p.longestStreak ?? 0;
      const migratedRunsCompleted = p.lifetimeRunsCompleted ?? 0;

      return {
        ...state,
        programStartDate: migratedStartDate,
        maxCompletedDay: migratedMaxDay,
        lastSessionDayKey: p.lastSessionDayKey,
        consecutiveStreak: p.consecutiveStreak,
        lifetimeTotalMinutes: migratedLifetimeMinutes,
        lifetimeLongestStreak: migratedLifetimeLongest,
        lifetimeRunsCompleted: migratedRunsCompleted,
        lifetimeExecutionBlocks: p.lifetimeExecutionBlocks ?? 0,
        lifetimeExecutionMinutes: p.lifetimeExecutionMinutes ?? 0,
        activeSession: p.activeSession,
        lastLockInCompletedDate: p.lastLockInCompletedDate ?? null,
        lastUnlockCompletedDate: p.lastUnlockCompletedDate ?? null,
        phase: p.activeSession ? 'ACTIVE' : 'IDLE',
      };
    }

    case 'SET_ANIMATING': {
      // Guard: only from IDLE, and Lock In not completed today
      const todayKey = getTodayKey();
      if (state.phase !== 'IDLE' || state.lastLockInCompletedDate === todayKey) return state;
      return { ...state, phase: 'ANIMATING' };
    }

    case 'START_SESSION': {
      // Guard: only from ANIMATING
      if (state.phase !== 'ANIMATING') return state;
      const todayKey = getTodayKey();
      return {
        ...state,
        phase: 'ACTIVE',
        activeSession: {
          startTimestamp: action.payload.startTimestamp,
          expectedEndTimestamp: action.payload.expectedEndTimestamp,
          durationMinutes: action.payload.durationMinutes,
        },
        // Initialize programStartDate on first session ever
        programStartDate: state.programStartDate || todayKey,
      };
    }

    case 'UPDATE_SESSION_END': {
      if (!state.activeSession) return state;
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          expectedEndTimestamp: action.payload.expectedEndTimestamp,
          durationMinutes: action.payload.durationMinutes,
        },
      };
    }

    case 'COMPLETE_SESSION': {
      // Guard: only from ACTIVE or COMPLETING
      if (state.phase !== 'ACTIVE' && state.phase !== 'COMPLETING') return state;

      const todayKey = getTodayKey();
      const alreadyCompletedToday = state.lastLockInCompletedDate === todayKey;

      // Advance program day (only if not already completed today)
      const newMaxDay = alreadyCompletedToday
        ? state.maxCompletedDay
        : Math.min(90, state.maxCompletedDay + 1);

      const newStreak = alreadyCompletedToday
        ? state.consecutiveStreak
        : computeNewStreak(
            state.lastSessionDayKey,
            state.consecutiveStreak,
            todayKey,
          );

      const newLifetimeLongest = Math.max(state.lifetimeLongestStreak, newStreak);
      const newLifetimeMinutes = state.lifetimeTotalMinutes + (action.payload.durationMinutes || 0);

      // Session day key: use the day the session started (for midnight rollover)
      const sessionDayKey = state.activeSession
        ? new Date(state.activeSession.startTimestamp).toISOString().slice(0, 10)
        : todayKey;

      return {
        ...state,
        phase: 'IDLE',
        activeSession: null,
        maxCompletedDay: newMaxDay,
        lastSessionDayKey: sessionDayKey,
        consecutiveStreak: newStreak,
        lifetimeTotalMinutes: newLifetimeMinutes,
        lifetimeLongestStreak: newLifetimeLongest,
        lastLockInCompletedDate: todayKey,
      };
    }

    case 'COMPLETE_UNLOCK': {
      // Unlock completion: adds to lifetimeTotalMinutes, marks unlock as done today
      // Does NOT affect streak or maxCompletedDay (Lock In only)
      const todayKey = getTodayKey();
      return {
        ...state,
        phase: 'IDLE',
        activeSession: null,
        lifetimeTotalMinutes: state.lifetimeTotalMinutes + (action.payload.durationMinutes || 0),
        lastUnlockCompletedDate: todayKey,
      };
    }

    case 'COMPLETE_EXECUTION_BLOCK': {
      const mins = action.payload.durationMinutes || 0;
      return {
        ...state,
        lifetimeExecutionBlocks: state.lifetimeExecutionBlocks + 1,
        lifetimeExecutionMinutes: state.lifetimeExecutionMinutes + mins,
        lifetimeTotalMinutes: state.lifetimeTotalMinutes + mins,
      };
    }

    case 'RESET_PHASE': {
      return { ...state, phase: 'IDLE' };
    }

    case 'RESET_PROGRAM': {
      // Reset current run, preserve lifetime stats
      return {
        ...state,
        phase: 'IDLE',
        programStartDate: null,
        maxCompletedDay: 0,
        lastSessionDayKey: null,
        consecutiveStreak: 0,
        activeSession: null,
        lastLockInCompletedDate: null,
        lastUnlockCompletedDate: null,
        // Lifetime stats survive
        lifetimeRunsCompleted: state.lifetimeRunsCompleted + 1,
        // lifetimeTotalMinutes and lifetimeLongestStreak stay
      };
    }

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────

interface SessionContextValue {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
  isHydrated: boolean;
}

const SessionContext = createContext<SessionContextValue>({
  state: initialState,
  dispatch: () => {},
  isHydrated: false,
});

// ─── Provider ────────────────────────────────────────────────────

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const isFirstRender = useRef(true);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const persisted: PersistedSessionState = JSON.parse(raw);
          dispatch({ type: 'HYDRATE', payload: persisted });
        }
      } catch (e) {
        // Storage read failed — continue with defaults
        console.warn('[SessionProvider] Hydration failed:', e);
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  // Persist to AsyncStorage on every state change (skip first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isHydrated) return;

    const persisted: PersistedSessionState = {
      programStartDate: state.programStartDate,
      maxCompletedDay: state.maxCompletedDay,
      lastSessionDayKey: state.lastSessionDayKey,
      consecutiveStreak: state.consecutiveStreak,
      lifetimeTotalMinutes: state.lifetimeTotalMinutes,
      lifetimeLongestStreak: state.lifetimeLongestStreak,
      lifetimeRunsCompleted: state.lifetimeRunsCompleted,
      lifetimeExecutionBlocks: state.lifetimeExecutionBlocks,
      lifetimeExecutionMinutes: state.lifetimeExecutionMinutes,
      activeSession: state.activeSession,
      lastLockInCompletedDate: state.lastLockInCompletedDate,
      lastUnlockCompletedDate: state.lastUnlockCompletedDate,
    };

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch((e) => {
      console.warn('[SessionProvider] Persist failed:', e);
    });
  }, [
    isHydrated,
    state.programStartDate,
    state.maxCompletedDay,
    state.lastSessionDayKey,
    state.consecutiveStreak,
    state.lifetimeTotalMinutes,
    state.lifetimeLongestStreak,
    state.lifetimeRunsCompleted,
    state.lifetimeExecutionBlocks,
    state.lifetimeExecutionMinutes,
    state.activeSession,
    state.lastLockInCompletedDate,
    state.lastUnlockCompletedDate,
  ]);

  return (
    <SessionContext.Provider value={{ state, dispatch, isHydrated }}>
      {children}
    </SessionContext.Provider>
  );
};

// ─── Hook ────────────────────────────────────────────────────────

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}
