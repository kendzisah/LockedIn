/**
 * SessionProvider — Global session state with persistence.
 *
 * Program-day progression:
 *   - maxCompletedDay tracks how many program days finished (0-90)
 *   - Execution block completion (COMPLETE_EXECUTION_BLOCK) increments maxCompletedDay
 *   - Streak increments via DAILY_GOAL_MET when daily focus goal is hit
 *
 * Lifetime vs current-run:
 *   - lifetimeTotalMinutes / lifetimeLongestStreak / lifetimeRunsCompleted survive across program completion
 *
 * HYDRATE handles legacy shapes (startDayKey, completedDayKeys, etc.) for migration.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Analytics } from '../../../services/AnalyticsService';
import { subscribeLogoutCleanup } from '../../../services/logoutCleanupBus';
import { StatsService } from '../../../services/StatsService';
import { XPService } from '../../../services/XPService';
import { AchievementService } from '../../../services/AchievementService';
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
  lastLockInCompletedDate: null,
  dailyFocusedMinutes: 0,
  dailyFocusDate: null,
  dailyGoalMetDate: null,
  weekCompletedDays: [],
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
        lastLockInCompletedDate: p.lastLockInCompletedDate ?? null,
        dailyFocusedMinutes: p.dailyFocusedMinutes ?? 0,
        dailyFocusDate: p.dailyFocusDate ?? null,
        dailyGoalMetDate: p.dailyGoalMetDate ?? null,
        weekCompletedDays: Array.isArray(p.weekCompletedDays) ? p.weekCompletedDays : [],
        phase: 'IDLE',
      };
    }

    case 'SET_ANIMATING': {
      if (state.phase !== 'IDLE') return state;
      return { ...state, phase: 'ANIMATING' };
    }

    case 'COMPLETE_EXECUTION_BLOCK': {
      const mins = action.payload.durationMinutes || 0;
      const todayKey = getTodayKey();
      const alreadyAdvancedToday = state.lastLockInCompletedDate === todayKey;
      const newMaxDay = alreadyAdvancedToday
        ? state.maxCompletedDay
        : state.maxCompletedDay + 1;
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

      // Add today to weekly completed days (keep only current week)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(monday.getDate() + mondayOffset);
      const mondayKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;

      const updatedWeekDays = state.weekCompletedDays
        .filter((dk) => dk >= mondayKey) // prune days from previous weeks
        .concat(todayKey);

      return {
        ...state,
        consecutiveStreak: newStreak,
        lifetimeLongestStreak: newLifetimeLongest,
        lastSessionDayKey: todayKey,
        dailyGoalMetDate: todayKey,
        weekCompletedDays: [...new Set(updatedWeekDays)],
      };
    }

    case 'RESET_PHASE': {
      return { ...state, phase: 'IDLE' };
    }

    case 'FULL_RESET': {
      return {
        ...initialState,
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

  useEffect(() => {
    return subscribeLogoutCleanup(() => {
      dispatch({ type: 'FULL_RESET' });
    });
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
      lastLockInCompletedDate: state.lastLockInCompletedDate,
      dailyFocusedMinutes: state.dailyFocusedMinutes,
      dailyFocusDate: state.dailyFocusDate,
      dailyGoalMetDate: state.dailyGoalMetDate,
      weekCompletedDays: state.weekCompletedDays,
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
    state.lastLockInCompletedDate,
    state.dailyFocusedMinutes,
    state.dailyFocusDate,
    state.dailyGoalMetDate,
    state.weekCompletedDays,
  ]);

  // ── Mixpanel: super properties (auto-attached to every event) ──
  useEffect(() => {
    if (!isHydrated) return;
    Analytics.setStreakDays(state.consecutiveStreak);
    Analytics.registerSuperProperties({
      streak: state.consecutiveStreak,
      lifetime_minutes: state.lifetimeTotalMinutes,
    });
  }, [isHydrated, state.maxCompletedDay, state.consecutiveStreak, state.lifetimeTotalMinutes]);

  // ── Mixpanel: streak broken detection ──
  const prevStreak = useRef(state.consecutiveStreak);
  useEffect(() => {
    if (!isHydrated) return;
    if (prevStreak.current > 0 && state.consecutiveStreak === 0 && state.consecutiveStreak < prevStreak.current) {
      Analytics.track('Streak Broken', {
        previous_streak: prevStreak.current,
        last_session_date: state.lastSessionDayKey,
      });
    }
    prevStreak.current = state.consecutiveStreak;
  }, [isHydrated, state.consecutiveStreak, state.maxCompletedDay]);

  // ── Mixpanel: execution block completion ──
  const prevExecBlocks = useRef(state.lifetimeExecutionBlocks);
  const prevExecMinutes = useRef(state.lifetimeExecutionMinutes);
  useEffect(() => {
    if (!isHydrated) return;
    if (state.lifetimeExecutionBlocks > prevExecBlocks.current) {
      const minutesDelta = Math.max(
        0,
        state.lifetimeExecutionMinutes - prevExecMinutes.current,
      );
      Analytics.track('Lock In Completed', {
        total_blocks: state.lifetimeExecutionBlocks,
        total_exec_minutes: state.lifetimeExecutionMinutes,
      });

      // Stats / XP / achievements pipeline. Fire-and-forget; failures fall back
      // to next-session recompute. Safe no-op when Supabase auth is unavailable.
      const streakDays = state.consecutiveStreak;
      void (async () => {
        await Promise.all([
          StatsService.bumpCounter('total_focus_minutes', minutesDelta),
          StatsService.bumpCounter('total_completed_sessions', 1),
          StatsService.bumpCounter('total_sessions', 1),
        ]);
        await XPService.award({
          type: 'session_complete',
          data: { durationMinutes: minutesDelta, currentStreakDays: streakDays },
        });
        await StatsService.recompute();
        await AchievementService.evaluate(StatsService.getCached());
      })();
    }
    prevExecBlocks.current = state.lifetimeExecutionBlocks;
    prevExecMinutes.current = state.lifetimeExecutionMinutes;
  }, [isHydrated, state.lifetimeExecutionBlocks, state.lifetimeExecutionMinutes, state.consecutiveStreak]);

  // ── user_stats: keep current_streak_days in sync; bump total_streak_days on growth ──
  const prevStatsStreak = useRef(state.consecutiveStreak);
  useEffect(() => {
    if (!isHydrated) return;
    const next = state.consecutiveStreak;
    const prev = prevStatsStreak.current;
    if (next === prev) return;

    void (async () => {
      if (next > prev) {
        await StatsService.bumpCounter('total_streak_days', next - prev);
      }
      await StatsService.setStreak(next);
      await StatsService.recompute();
      await AchievementService.evaluate(StatsService.getCached());
    })();
    prevStatsStreak.current = next;
  }, [isHydrated, state.consecutiveStreak]);

  // ── AppsFlyer: first program day completed (tutorial completion is home guide dismiss) ──
  useEffect(() => {
    if (!isHydrated || state.maxCompletedDay < 1) return;

    (async () => {
      try {
        const sent = await AsyncStorage.getItem(AF_FIRST_SESSION_KEY);
        if (!sent) {
          Analytics.trackAF('af_first_lock_in', {
            af_success: '1',
            af_content_id: 'first_program_day',
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
          Analytics.trackAF('af_achievement_unlocked', {
            af_description: `streak_${milestone}`,
            af_score: String(milestone),
          });
          Analytics.trackAF('af_level_achieved', {
            af_level: String(milestone),
            af_score: String(state.consecutiveStreak),
          });
          Analytics.track('Streak Milestone Reached', {
            days: milestone,
            color_tier: String(milestone),
          });
          sent.push(milestone);
        }

        if (newMilestones.length > 0) {
          await AsyncStorage.setItem(AF_MILESTONES_KEY, JSON.stringify(sent));
        }
      } catch {}
    })();
  }, [isHydrated, state.consecutiveStreak]);

  const contextValue = useMemo(
    () => ({ state, dispatch, isHydrated }),
    [state, isHydrated],
  );

  return (
    <SessionContext.Provider value={contextValue}>
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
