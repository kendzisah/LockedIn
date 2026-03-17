/**
 * SessionProvider — Global session state with persistence and crash-resume.
 *
 * Phase transitions enforced: IDLE -> ANIMATING -> ACTIVE -> COMPLETING -> IDLE
 * Invalid transitions are no-ops.
 *
 * Program-day progression:
 *   - maxCompletedDay tracks how many program days finished (0-90)
 *   - Only Lock In (COMPLETE_EXECUTION_BLOCK) increments maxCompletedDay
 *   - Alignment/Unlock add listening time but do NOT advance the day
 *   - Streak increments via DAILY_GOAL_MET when daily focus goal is hit
 *
 * Lifetime vs current-run:
 *   - lifetimeTotalMinutes / lifetimeLongestStreak / lifetimeRunsCompleted survive across program completion
 *   - After 90 days, programCompleteSeen flag hides the progress bar
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
import { AppsFlyerService } from '../../../services/AppsFlyerService';
import { MixpanelService } from '../../../services/MixpanelService';
import type {
  SessionState,
  SessionAction,
  PersistedSessionState,
} from './types';
import { getTodayKey, computeNewStreak, dayKeyFromTimestamp } from '../engine/SessionEngine';

// ─── Constants ───────────────────────────────────────────────────

const STORAGE_KEY = '@lockedin/session_state';
const AF_FIRST_SESSION_KEY = '@lockedin/af_first_session_sent';
const AF_MILESTONES_KEY = '@lockedin/af_streak_milestones_sent';
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90] as const;

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
  dailyFocusedMinutes: 0,
  dailyFocusDate: null,
  dailyGoalMetDate: null,
  programCompleteSeen: false,
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
        dailyFocusedMinutes: p.dailyFocusedMinutes ?? 0,
        dailyFocusDate: p.dailyFocusDate ?? null,
        dailyGoalMetDate: p.dailyGoalMetDate ?? null,
        programCompleteSeen: p.programCompleteSeen ?? false,
        phase: p.activeSession ? 'ACTIVE' : 'IDLE',
      };
    }

    case 'SET_ANIMATING': {
      if (state.phase !== 'IDLE') return state;
      return { ...state, phase: 'ANIMATING' };
    }

    case 'START_SESSION': {
      if (state.phase !== 'IDLE' && state.phase !== 'ANIMATING') return state;
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
      if (state.phase !== 'ACTIVE' && state.phase !== 'COMPLETING') return state;

      const todayKey = getTodayKey();
      const newLifetimeMinutes = state.lifetimeTotalMinutes + (action.payload.durationMinutes || 0);

      const focusBase = state.dailyFocusDate === todayKey ? state.dailyFocusedMinutes : 0;
      return {
        ...state,
        phase: 'IDLE',
        activeSession: null,
        lifetimeTotalMinutes: newLifetimeMinutes,
        lastLockInCompletedDate: todayKey,
        dailyFocusedMinutes: focusBase + (action.payload.durationMinutes || 0),
        dailyFocusDate: todayKey,
      };
    }

    case 'COMPLETE_UNLOCK': {
      const todayKey = getTodayKey();
      const focusBase = state.dailyFocusDate === todayKey ? state.dailyFocusedMinutes : 0;
      return {
        ...state,
        phase: 'IDLE',
        activeSession: null,
        lifetimeTotalMinutes: state.lifetimeTotalMinutes + (action.payload.durationMinutes || 0),
        lastUnlockCompletedDate: todayKey,
        dailyFocusedMinutes: focusBase + (action.payload.durationMinutes || 0),
        dailyFocusDate: todayKey,
      };
    }

    case 'COMPLETE_EXECUTION_BLOCK': {
      const mins = action.payload.durationMinutes || 0;
      const todayKey = getTodayKey();
      const alreadyAdvancedToday = state.lastLockInCompletedDate === todayKey;
      const newMaxDay = alreadyAdvancedToday
        ? state.maxCompletedDay
        : Math.min(90, state.maxCompletedDay + 1);
      const focusBase = state.dailyFocusDate === todayKey ? state.dailyFocusedMinutes : 0;
      return {
        ...state,
        maxCompletedDay: newMaxDay,
        lastLockInCompletedDate: todayKey,
        lifetimeExecutionBlocks: state.lifetimeExecutionBlocks + 1,
        lifetimeExecutionMinutes: state.lifetimeExecutionMinutes + mins,
        lifetimeTotalMinutes: state.lifetimeTotalMinutes + mins,
        dailyFocusedMinutes: focusBase + mins,
        dailyFocusDate: todayKey,
      };
    }

    case 'ADD_DAILY_FOCUS': {
      const todayKey = getTodayKey();
      const base = state.dailyFocusDate === todayKey ? state.dailyFocusedMinutes : 0;
      return {
        ...state,
        dailyFocusedMinutes: base + action.payload.minutes,
        dailyFocusDate: todayKey,
      };
    }

    case 'DAILY_GOAL_MET': {
      const todayKey = getTodayKey();
      if (state.dailyGoalMetDate === todayKey) return state;

      const newStreak = computeNewStreak(
        state.lastSessionDayKey,
        state.consecutiveStreak,
        todayKey,
      );
      const newLifetimeLongest = Math.max(state.lifetimeLongestStreak, newStreak);

      return {
        ...state,
        consecutiveStreak: newStreak,
        lifetimeLongestStreak: newLifetimeLongest,
        lastSessionDayKey: todayKey,
        dailyGoalMetDate: todayKey,
      };
    }

    case 'MARK_PROGRAM_SEEN': {
      return { ...state, programCompleteSeen: true };
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
      dailyFocusedMinutes: state.dailyFocusedMinutes,
      dailyFocusDate: state.dailyFocusDate,
      dailyGoalMetDate: state.dailyGoalMetDate,
      programCompleteSeen: state.programCompleteSeen,
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
    state.dailyFocusedMinutes,
    state.dailyFocusDate,
    state.dailyGoalMetDate,
  ]);

  // ── Mixpanel: super properties (auto-attached to every event) ──
  useEffect(() => {
    if (!isHydrated) return;
    MixpanelService.registerSuperProperties({
      program_day: state.maxCompletedDay,
      streak: state.consecutiveStreak,
      lifetime_minutes: state.lifetimeTotalMinutes,
    });
  }, [isHydrated, state.maxCompletedDay, state.consecutiveStreak, state.lifetimeTotalMinutes]);

  // ── Mixpanel: streak broken detection ──
  const prevStreak = useRef(state.consecutiveStreak);
  useEffect(() => {
    if (!isHydrated) return;
    if (prevStreak.current > 0 && state.consecutiveStreak === 0 && state.consecutiveStreak < prevStreak.current) {
      MixpanelService.track('Streak Broken', {
        previous_streak: prevStreak.current,
        program_day: state.maxCompletedDay,
      });
    }
    prevStreak.current = state.consecutiveStreak;
  }, [isHydrated, state.consecutiveStreak, state.maxCompletedDay]);

  // ── Mixpanel: program completed (Day 90) ──
  useEffect(() => {
    if (!isHydrated) return;
    if (state.maxCompletedDay >= 90) {
      MixpanelService.track('Program Completed', {
        lifetime_minutes: state.lifetimeTotalMinutes,
        longest_streak: state.lifetimeLongestStreak,
      });
      MixpanelService.setUserProperties({ program_completed: true, program_completed_at: new Date().toISOString() });
    }
  }, [isHydrated, state.maxCompletedDay, state.lifetimeTotalMinutes, state.lifetimeLongestStreak]);

  // ── Mixpanel: session completion ──
  const prevLockInDate = useRef(state.lastLockInCompletedDate);
  const prevUnlockDate = useRef(state.lastUnlockCompletedDate);

  useEffect(() => {
    if (!isHydrated) return;
    if (state.lastLockInCompletedDate && state.lastLockInCompletedDate !== prevLockInDate.current) {
      MixpanelService.track('Alignment Completed', {
        program_day: state.maxCompletedDay,
        streak: state.consecutiveStreak,
        lifetime_minutes: state.lifetimeTotalMinutes,
      });
    }
    prevLockInDate.current = state.lastLockInCompletedDate;
  }, [isHydrated, state.lastLockInCompletedDate, state.maxCompletedDay, state.consecutiveStreak, state.lifetimeTotalMinutes]);

  useEffect(() => {
    if (!isHydrated) return;
    if (state.lastUnlockCompletedDate && state.lastUnlockCompletedDate !== prevUnlockDate.current) {
      MixpanelService.track('Reflection Completed', {
        program_day: state.maxCompletedDay,
        lifetime_minutes: state.lifetimeTotalMinutes,
      });
    }
    prevUnlockDate.current = state.lastUnlockCompletedDate;
  }, [isHydrated, state.lastUnlockCompletedDate, state.maxCompletedDay, state.lifetimeTotalMinutes]);

  // ── Mixpanel: execution block completion ──
  const prevExecBlocks = useRef(state.lifetimeExecutionBlocks);
  useEffect(() => {
    if (!isHydrated) return;
    if (state.lifetimeExecutionBlocks > prevExecBlocks.current) {
      MixpanelService.track('Lock In Completed', {
        total_blocks: state.lifetimeExecutionBlocks,
        total_exec_minutes: state.lifetimeExecutionMinutes,
      });
    }
    prevExecBlocks.current = state.lifetimeExecutionBlocks;
  }, [isHydrated, state.lifetimeExecutionBlocks, state.lifetimeExecutionMinutes]);

  // ── AppsFlyer: first session activation ──
  useEffect(() => {
    if (!isHydrated || state.maxCompletedDay < 1) return;

    (async () => {
      try {
        const sent = await AsyncStorage.getItem(AF_FIRST_SESSION_KEY);
        if (!sent) {
          AppsFlyerService.logEvent('af_tutorial_completion', {
            af_success: '1',
            af_content_id: 'first_lock_in',
          });
          await AsyncStorage.setItem(AF_FIRST_SESSION_KEY, '1');
        }
      } catch {}
    })();
  }, [isHydrated, state.maxCompletedDay]);

  // ── AppsFlyer: streak milestones ──
  useEffect(() => {
    if (!isHydrated || state.consecutiveStreak < STREAK_MILESTONES[0]) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(AF_MILESTONES_KEY);
        const sent: number[] = raw ? JSON.parse(raw) : [];

        const newMilestones = STREAK_MILESTONES.filter(
          (m) => state.consecutiveStreak >= m && !sent.includes(m),
        );

        for (const milestone of newMilestones) {
          AppsFlyerService.logEvent('af_achievement_unlocked', {
            af_description: `streak_${milestone}`,
            af_score: String(milestone),
          });
          MixpanelService.track('Streak Milestone', {
            milestone_days: milestone,
            current_streak: state.consecutiveStreak,
            program_day: state.maxCompletedDay,
          });
          sent.push(milestone);
        }

        if (newMilestones.length > 0) {
          await AsyncStorage.setItem(AF_MILESTONES_KEY, JSON.stringify(sent));
        }
      } catch {}
    })();
  }, [isHydrated, state.consecutiveStreak]);

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
