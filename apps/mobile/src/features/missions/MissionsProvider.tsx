/**
 * MissionsProvider.tsx
 * Context provider for the 3-slot daily mission system with AsyncStorage persistence
 * and cumulative XP tracking.
 */

import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Mission,
  generateDailyMissions,
  generateWeeklyMissions,
  getMissionWeekKey,
  getRemainingDaysInWeek,
  getCompletedCount,
  calculateTotalXP,
} from './MissionEngine';
import { CrewService } from '../leaderboard/CrewService';
import { Analytics } from '../../services/AnalyticsService';
import { subscribeLogoutCleanup } from '../../services/logoutCleanupBus';

// ─── Local-time helpers ──────────────────────────────────

/** YYYY-MM-DD in the device's local timezone. */
const getLocalDateString = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Milliseconds until the next local midnight (+ 50 ms buffer to avoid edge races). */
const msUntilLocalMidnight = (): number => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return midnight.getTime() - now.getTime() + 50;
};

// ─── Action types ───────────────────────────────────────

type MissionAction =
  | { type: 'HYDRATE'; payload: MissionsState }
  | { type: 'GENERATE_DAILY'; payload: { missions: Mission[]; date: string } }
  | { type: 'COMPLETE_MISSION'; payload: string }
  | { type: 'SET_WEEKLY_MISSIONS'; payload: { weeklyMissions: Mission[]; weekKey: string } }
  | { type: 'UPDATE_WEEKLY_PROGRESS'; payload: { missionId: string; progress: number; remainingDays: number } }
  | { type: 'RESET_DAY' }
  | { type: 'FULL_LOGOUT_RESET' };

// ─── State ──────────────────────────────────────────────

export interface MissionsState {
  missions: Mission[];
  date: string;
  completedCount: number;
  /** XP earned today (resets each day). */
  dailyXP: number;
  /** Cumulative lifetime XP (never resets). */
  totalXP: number;
  lockedInToday: boolean;
  /** Weekly missions that persist across the week. */
  weeklyMissions: Mission[];
  /** ISO week key for current weekly missions. */
  weekKey: string;
}

interface MissionsContextType extends MissionsState {
  completeMission: (missionId: string) => void;
  generateDailyMissions: (goal: string) => void;
  /** Regenerate today's 3 missions (optional overrides for immediate post-settings update). */
  regenerateTodaysMissions: (override?: { goal?: string; weaknesses?: string[] }) => void;
  resetDay: () => void;
}

const MissionsContext = createContext<MissionsContextType | undefined>(undefined);

const getInitialState = (): MissionsState => ({
  missions: [],
  weeklyMissions: [],
  weekKey: getMissionWeekKey(),
  date: getLocalDateString(),
  completedCount: 0,
  dailyXP: 0,
  totalXP: 0,
  lockedInToday: false,
});

// ─── Storage keys ───────────────────────────────────────

const KEY_MISSIONS = '@lockedin/daily_missions';
const KEY_DATE = '@lockedin/daily_missions_date';
const KEY_CUMULATIVE_XP = '@lockedin/cumulative_xp';
const KEY_WEEKLY_MISSIONS = '@lockedin/weekly_missions';
const KEY_WEEKLY_WEEK = '@lockedin/weekly_missions_week';
const KEY_ACTIVE_DAYS = '@lockedin/weekly_active_days';
const KEY_EARLY_OPENS = '@lockedin/weekly_early_opens';

// ─── Reducer ────────────────────────────────────────────

const missionsReducer = (state: MissionsState, action: MissionAction): MissionsState => {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload;

    case 'GENERATE_DAILY': {
      const completedCount = getCompletedCount(action.payload.missions);
      const dailyXP = calculateTotalXP(action.payload.missions.filter((m) => m.completed));
      return {
        ...state,
        missions: action.payload.missions,
        date: action.payload.date,
        completedCount,
        dailyXP,
        lockedInToday: completedCount === action.payload.missions.length,
      };
    }

    case 'COMPLETE_MISSION': {
      const updated = state.missions.map((m) =>
        m.id === action.payload ? { ...m, completed: true } : m,
      );
      const justCompleted = state.missions.find((m) => m.id === action.payload && !m.completed);
      const xpGained = justCompleted ? justCompleted.xp : 0;
      const completedCount = getCompletedCount(updated);
      const dailyXP = calculateTotalXP(updated.filter((m) => m.completed));

      return {
        ...state,
        missions: updated,
        completedCount,
        dailyXP,
        totalXP: state.totalXP + xpGained,
        lockedInToday: completedCount === updated.length,
      };
    }

    case 'SET_WEEKLY_MISSIONS':
      return {
        ...state,
        weeklyMissions: action.payload.weeklyMissions,
        weekKey: action.payload.weekKey,
      };

    case 'UPDATE_WEEKLY_PROGRESS': {
      const remaining = action.payload.remainingDays;
      const updatedWeekly = state.weeklyMissions.map((m) => {
        if (m.id !== action.payload.missionId) return m;
        if (m.completed || m.failed) return m;
        const newProgress = action.payload.progress;
        const completed = m.progressTarget != null && newProgress >= m.progressTarget;
        // Check if it's still mathematically possible to reach the target.
        // remaining counts days AFTER today; +1 includes today if there's still time.
        const possibleDays = newProgress + remaining + 1;
        const failed = !completed && m.progressTarget != null && possibleDays < m.progressTarget;
        return { ...m, progress: newProgress, completed, failed };
      });
      return { ...state, weeklyMissions: updatedWeekly };
    }

    case 'RESET_DAY':
      return {
        ...state,
        missions: [],
        date: getLocalDateString(),
        completedCount: 0,
        dailyXP: 0,
        lockedInToday: false,
      };

    case 'FULL_LOGOUT_RESET':
      return getInitialState();

    default:
      return state;
  }
};

// ─── Persistence helpers ────────────────────────────────

const persistMissions = async (missions: Mission[], date: string) => {
  await Promise.all([
    AsyncStorage.setItem(KEY_MISSIONS, JSON.stringify(missions)),
    AsyncStorage.setItem(KEY_DATE, date),
  ]);
};

const persistCumulativeXP = async (xp: number) => {
  await AsyncStorage.setItem(KEY_CUMULATIVE_XP, String(xp));
};

const persistWeeklyMissions = async (missions: Mission[], weekKey: string) => {
  await Promise.all([
    AsyncStorage.setItem(KEY_WEEKLY_MISSIONS, JSON.stringify(missions)),
    AsyncStorage.setItem(KEY_WEEKLY_WEEK, weekKey),
  ]);
};

/** Record that today was an active day (had a focus session). */
export const recordActiveDay = async (): Promise<void> => {
  try {
    const today = getLocalDateString();
    const weekKey = getMissionWeekKey();
    const raw = await AsyncStorage.getItem(KEY_ACTIVE_DAYS);
    const stored = raw ? JSON.parse(raw) as { weekKey: string; days: string[] } : null;
    if (stored?.weekKey !== weekKey) {
      await AsyncStorage.setItem(KEY_ACTIVE_DAYS, JSON.stringify({ weekKey, days: [today] }));
      return;
    }
    if (!stored.days.includes(today)) {
      stored.days.push(today);
      await AsyncStorage.setItem(KEY_ACTIVE_DAYS, JSON.stringify(stored));
    }
  } catch (e) { console.warn('[MissionsProvider] recordActiveDay failed:', e); }
};

/** Get count of active days this week. */
const getActiveDaysCount = async (): Promise<number> => {
  try {
    const weekKey = getMissionWeekKey();
    const raw = await AsyncStorage.getItem(KEY_ACTIVE_DAYS);
    if (!raw) return 0;
    const stored = JSON.parse(raw) as { weekKey: string; days: string[] };
    return stored.weekKey === weekKey ? stored.days.length : 0;
  } catch { return 0; }
};

/** Record that the app was opened before 9 AM today. */
export const recordEarlyOpen = async (): Promise<void> => {
  try {
    const now = new Date();
    if (now.getHours() >= 9) return;
    const today = getLocalDateString();
    const weekKey = getMissionWeekKey();
    const raw = await AsyncStorage.getItem(KEY_EARLY_OPENS);
    const stored = raw ? JSON.parse(raw) as { weekKey: string; days: string[] } : null;
    if (stored?.weekKey !== weekKey) {
      await AsyncStorage.setItem(KEY_EARLY_OPENS, JSON.stringify({ weekKey, days: [today] }));
      return;
    }
    if (!stored.days.includes(today)) {
      stored.days.push(today);
      await AsyncStorage.setItem(KEY_EARLY_OPENS, JSON.stringify(stored));
    }
  } catch (e) { console.warn('[MissionsProvider] recordEarlyOpen failed:', e); }
};

/** Get count of early opens this week. */
const getEarlyOpensCount = async (): Promise<number> => {
  try {
    const weekKey = getMissionWeekKey();
    const raw = await AsyncStorage.getItem(KEY_EARLY_OPENS);
    if (!raw) return 0;
    const stored = JSON.parse(raw) as { weekKey: string; days: string[] };
    return stored.weekKey === weekKey ? stored.days.length : 0;
  } catch { return 0; }
};

const loadCumulativeXP = async (): Promise<number> => {
  const raw = await AsyncStorage.getItem(KEY_CUMULATIVE_XP);
  return raw ? parseInt(raw, 10) || 0 : 0;
};

// ─── Provider ───────────────────────────────────────────

interface ProviderProps {
  children: ReactNode;
  userGoal?: string;
  userWeaknesses?: string[];
  onboardingDate?: string;
  streak?: number;
}

export const MissionsProvider: React.FC<ProviderProps> = ({
  children,
  userGoal = 'Increase discipline & self-control',
  userWeaknesses = [],
  onboardingDate,
  streak = 0,
}) => {
  const [state, dispatch] = useReducer(missionsReducer, getInitialState());
  const midnightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crewUpdateQueue = useRef<Promise<void>>(Promise.resolve());

  // Stable key for userWeaknesses to avoid re-creating callbacks on every render
  const weaknessesKey = userWeaknesses.join(',');
  const stableWeaknesses = useMemo(() => userWeaknesses, [weaknessesKey]);

  const hydrate = useCallback(async () => {
    try {
      const [storedMissions, storedDate, cumulativeXP] = await Promise.all([
        AsyncStorage.getItem(KEY_MISSIONS),
        AsyncStorage.getItem(KEY_DATE),
        loadCumulativeXP(),
      ]);

      const today = getLocalDateString();

      if (storedMissions && storedDate === today) {
        const missions = JSON.parse(storedMissions) as Mission[];
        const completedCount = getCompletedCount(missions);
        const dailyXP = calculateTotalXP(missions.filter((m) => m.completed));

        dispatch({
          type: 'HYDRATE',
          payload: {
            missions,
            weeklyMissions: [],
            weekKey: getMissionWeekKey(),
            date: today,
            completedCount,
            dailyXP,
            totalXP: cumulativeXP,
            lockedInToday: completedCount === missions.length,
          },
        });
      } else {
        const newMissions = generateDailyMissions({
          goal: userGoal,
          weaknesses: stableWeaknesses,
          onboardingDate,
          streak,
        });

        dispatch({
          type: 'HYDRATE',
          payload: {
            missions: newMissions,
            weeklyMissions: [],
            weekKey: getMissionWeekKey(),
            date: today,
            completedCount: 0,
            dailyXP: 0,
            totalXP: cumulativeXP,
            lockedInToday: false,
          },
        });

        await persistMissions(newMissions, today);
      }

      // ── Weekly missions hydration ──
      const currentWeekKey = getMissionWeekKey();
      const [storedWeekly, storedWeekKey] = await Promise.all([
        AsyncStorage.getItem(KEY_WEEKLY_MISSIONS),
        AsyncStorage.getItem(KEY_WEEKLY_WEEK),
      ]);

      if (storedWeekly && storedWeekKey === currentWeekKey) {
        const weeklyMissions = JSON.parse(storedWeekly) as Mission[];
        dispatch({ type: 'SET_WEEKLY_MISSIONS', payload: { weeklyMissions, weekKey: currentWeekKey } });
      } else {
        const newWeekly = generateWeeklyMissions({
          goal: userGoal,
          weaknesses: stableWeaknesses,
          onboardingDate,
          streak,
        });
        dispatch({ type: 'SET_WEEKLY_MISSIONS', payload: { weeklyMissions: newWeekly, weekKey: currentWeekKey } });
        await persistWeeklyMissions(newWeekly, currentWeekKey);
      }
    } catch (error) {
      console.error('[MissionsProvider] Hydration failed:', error);
      const newMissions = generateDailyMissions({
        goal: userGoal,
        weaknesses: stableWeaknesses,
        onboardingDate,
        streak,
      });
      const today = getLocalDateString();
      dispatch({
        type: 'GENERATE_DAILY',
        payload: { missions: newMissions, date: today },
      });
    }
  }, [userGoal, stableWeaknesses, onboardingDate, streak]);

  // Initial hydration + re-hydrate when user props change
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    return subscribeLogoutCleanup(() => {
      dispatch({ type: 'FULL_LOGOUT_RESET' });
      void hydrate();
    });
  }, [hydrate]);

  // Schedule a timer for local midnight so missions refresh even if the app stays in foreground
  useEffect(() => {
    const scheduleMidnight = () => {
      if (midnightTimer.current) clearTimeout(midnightTimer.current);
      midnightTimer.current = setTimeout(() => {
        hydrate();
        scheduleMidnight();
      }, msUntilLocalMidnight());
    };
    scheduleMidnight();
    return () => {
      if (midnightTimer.current) clearTimeout(midnightTimer.current);
    };
  }, [hydrate]);

  // Re-hydrate when the app returns to foreground (covers sleep / background > midnight or week boundary)
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        const today = getLocalDateString();
        const currentWeekKey = getMissionWeekKey();
        if (today !== state.date || currentWeekKey !== state.weekKey) {
          hydrate();
        }
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [hydrate, state.date, state.weekKey]);

  // Persist missions on change
  useEffect(() => {
    if (state.missions.length > 0) {
      persistMissions(state.missions, state.date).catch(() => {});
    }
  }, [state.missions, state.date]);

  // Persist cumulative XP on change
  useEffect(() => {
    if (state.totalXP > 0) {
      persistCumulativeXP(state.totalXP).catch(() => {});
    }
  }, [state.totalXP]);

  // Persist weekly missions on change
  useEffect(() => {
    if (state.weeklyMissions.length > 0) {
      persistWeeklyMissions(state.weeklyMissions, state.weekKey).catch(() => {});
    }
  }, [state.weeklyMissions, state.weekKey]);

  // Update weekly mission progress on app foreground and daily hydration
  const updateWeeklyProgress = useCallback(async () => {
    if (state.weeklyMissions.length === 0) return;

    for (const m of state.weeklyMissions) {
      if (m.completed || !m.progressMetric || m.progressTarget == null) continue;

      let progress = 0;
      switch (m.progressMetric) {
        case 'days_active':
          progress = await getActiveDaysCount();
          break;
        case 'first_open_before_9am':
          progress = await getEarlyOpensCount();
          break;
        default:
          continue;
      }

      // Check if dispatch would actually change anything before dispatching
      const currentProgress = m.progress ?? 0;
      const remaining = getRemainingDaysInWeek();
      const wouldComplete = m.progressTarget != null && progress >= m.progressTarget;
      const possibleDays = progress + remaining + 1;
      const wouldFail = !wouldComplete && m.progressTarget != null && possibleDays < m.progressTarget;

      if (progress !== currentProgress || wouldFail !== (m.failed ?? false) || wouldComplete !== m.completed) {
        dispatch({ type: 'UPDATE_WEEKLY_PROGRESS', payload: { missionId: m.id, progress, remainingDays: remaining } });
      }
    }
  }, [state.weeklyMissions]);

  // Run progress check on hydration and foreground
  useEffect(() => {
    updateWeeklyProgress();
  }, [updateWeeklyProgress, state.date]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') updateWeeklyProgress();
    });
    return () => sub.remove();
  }, [updateWeeklyProgress]);

  const completeMission = (missionId: string) => {
    const mission = state.missions.find((m) => m.id === missionId);
    if (mission?.completed) return; // Guard against double-completion
    const completedCount = state.missions.filter((m) => m.completed).length + 1;

    if (mission) {
      Analytics.track('Mission Completed', {
        mission_id: mission.id,
        mission_title: mission.title,
        mission_type: mission.type,
        xp: mission.xp,
        slot: mission.slot,
        completed_count: completedCount,
      });
    }

    dispatch({ type: 'COMPLETE_MISSION', payload: missionId });

    if (completedCount === state.missions.length) {
      const missionXP = mission ? mission.xp : 0;
      Analytics.track('All Missions Completed', {
        total_xp: state.dailyXP + missionXP,
      });
    }

    // Queue crew stat updates to prevent concurrent read-increment-write races
    crewUpdateQueue.current = crewUpdateQueue.current.then(async () => {
      const retries = 2;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const stats = await CrewService.getWeeklyStats();
          const updated = { missions_done: stats.missions_done + 1 };
          await CrewService.updateWeeklyStats(updated);
          const latest = await CrewService.getWeeklyStats();

          const result = await CrewService.completeMissionServerSide(
            mission?.timeGate,
            latest.focus_minutes,
            latest.missions_done,
            latest.streak_days,
          );

          if (!result.success && result.error === 'time_gate_locked') {
            console.warn('[MissionsProvider] Server rejected: time gate not yet unlocked');
          }
          return;
        } catch (e) {
          if (attempt === retries) {
            console.error('[MissionsProvider] Crew score submission failed after retries:', e);
          } else {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
      }
    });
  };

  const generateDailyMissionsAction = (goal: string) => {
    const newMissions = generateDailyMissions({
      goal,
      weaknesses: stableWeaknesses,
      onboardingDate,
      streak,
    });
    const today = getLocalDateString();
    dispatch({ type: 'GENERATE_DAILY', payload: { missions: newMissions, date: today } });
  };

  const regenerateTodaysMissions = useCallback(
    (override?: { goal?: string; weaknesses?: string[] }) => {
      const newMissions = generateDailyMissions({
        goal: override?.goal ?? userGoal,
        weaknesses: override?.weaknesses ?? stableWeaknesses,
        onboardingDate,
        streak,
      });
      const today = getLocalDateString();
      dispatch({ type: 'GENERATE_DAILY', payload: { missions: newMissions, date: today } });
    },
    [userGoal, stableWeaknesses, onboardingDate, streak],
  );

  const resetDay = () => {
    dispatch({ type: 'RESET_DAY' });
  };

  const contextValue: MissionsContextType = useMemo(() => ({
    ...state,
    completeMission,
    generateDailyMissions: generateDailyMissionsAction,
    regenerateTodaysMissions,
    resetDay,
  }), [state, regenerateTodaysMissions]);

  return (
    <MissionsContext.Provider value={contextValue}>
      {children}
    </MissionsContext.Provider>
  );
};

export const useMissions = (): MissionsContextType => {
  const context = useContext(MissionsContext);
  if (!context) {
    throw new Error('useMissions must be used within a MissionsProvider');
  }
  return context;
};
