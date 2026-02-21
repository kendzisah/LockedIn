/**
 * SessionProvider — Global session state with persistence and crash-resume.
 *
 * Phase transitions enforced: IDLE -> ANIMATING -> ACTIVE -> COMPLETING -> IDLE
 * Invalid transitions are no-ops.
 *
 * Date-keyed completion: uses lastLockInCompletedDate / lastUnlockCompletedDate
 * instead of boolean completedToday -- prevents midnight bugs.
 *
 * All sessions are 5 min. Duration is a constant, not stored in state.
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
  startDayKey: null,
  completedDayKeys: [],
  lastSessionDayKey: null,
  consecutiveStreak: 0,
  longestStreak: 0,
  totalMinutes: 0,
  activeSession: null,
  lastLockInCompletedDate: null,
  lastUnlockCompletedDate: null,
};

// ─── Reducer ─────────────────────────────────────────────────────

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'HYDRATE': {
      const p = action.payload;
      return {
        ...state,
        startDayKey: p.startDayKey,
        completedDayKeys: p.completedDayKeys,
        lastSessionDayKey: p.lastSessionDayKey,
        consecutiveStreak: p.consecutiveStreak,
        longestStreak: p.longestStreak,
        totalMinutes: p.totalMinutes,
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
        // Initialize startDayKey on first session ever
        startDayKey: state.startDayKey || todayKey,
      };
    }

    case 'COMPLETE_SESSION': {
      // Guard: only from ACTIVE or COMPLETING
      if (state.phase !== 'ACTIVE' && state.phase !== 'COMPLETING') return state;

      const todayKey = getTodayKey();
      const alreadyCompletedToday = state.lastLockInCompletedDate === todayKey;

      // Session day key: use the day the session started (for midnight rollover)
      const sessionDayKey = state.activeSession
        ? new Date(state.activeSession.startTimestamp).toISOString().slice(0, 10)
        : todayKey;

      const newCompletedDayKeys = state.completedDayKeys.includes(sessionDayKey)
        ? state.completedDayKeys
        : [...state.completedDayKeys, sessionDayKey];

      const newStreak = alreadyCompletedToday
        ? state.consecutiveStreak
        : computeNewStreak(
            state.lastSessionDayKey,
            state.consecutiveStreak,
            todayKey,
            state.completedDayKeys,
          );

      const newLongest = Math.max(state.longestStreak, newStreak);

      return {
        ...state,
        phase: 'IDLE',
        activeSession: null,
        completedDayKeys: newCompletedDayKeys,
        lastSessionDayKey: sessionDayKey,
        consecutiveStreak: newStreak,
        longestStreak: newLongest,
        totalMinutes: state.totalMinutes + (action.payload.durationMinutes || 0),
        lastLockInCompletedDate: todayKey,
      };
    }

    case 'COMPLETE_UNLOCK': {
      // Unlock completion: adds to totalMinutes, marks unlock as done today
      // Does NOT affect streak or completedDayKeys (Lock In only)
      const todayKey = getTodayKey();
      return {
        ...state,
        phase: 'IDLE',
        activeSession: null,
        totalMinutes: state.totalMinutes + (action.payload.durationMinutes || 0),
        lastUnlockCompletedDate: todayKey,
      };
    }

    case 'RESET_PHASE': {
      return { ...state, phase: 'IDLE' };
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
      startDayKey: state.startDayKey,
      completedDayKeys: state.completedDayKeys,
      lastSessionDayKey: state.lastSessionDayKey,
      consecutiveStreak: state.consecutiveStreak,
      longestStreak: state.longestStreak,
      totalMinutes: state.totalMinutes,
      activeSession: state.activeSession,
      lastLockInCompletedDate: state.lastLockInCompletedDate,
      lastUnlockCompletedDate: state.lastUnlockCompletedDate,
    };

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch((e) => {
      console.warn('[SessionProvider] Persist failed:', e);
    });
  }, [
    isHydrated,
    state.startDayKey,
    state.completedDayKeys,
    state.lastSessionDayKey,
    state.consecutiveStreak,
    state.longestStreak,
    state.totalMinutes,
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
