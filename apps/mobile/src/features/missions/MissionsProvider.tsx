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
  generateWeeklyReplacementMission,
  normalizeWeeklyMissions,
  getMissionWeekKey,
  getRemainingDaysInWeek,
  getCompletedCount,
  calculateTotalXP,
  MAX_WEEKLY_CHALLENGES,
} from './MissionEngine';
import { CrewService } from '../leaderboard/CrewService';
import { recordPerfectMissionDay } from '../leaderboard/seasonMissionConsistency';
import {
  getMissionSeasonLabel,
  getMissionSeasonNumber,
  KEY_MISSION_XP_SEASON,
} from './missionXpSeason';
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
  | { type: 'UPDATE_DAILY_PROGRESS'; payload: { missionId: string; progress: number; progressTarget: number } }
  | { type: 'SET_WEEKLY_MISSIONS'; payload: { weeklyMissions: Mission[]; weekKey: string } }
  | { type: 'APPEND_WEEKLY_MISSION'; payload: Mission }
  | { type: 'UPDATE_WEEKLY_PROGRESS'; payload: { missionId: string; progress: number; remainingDays: number; todayCounted: boolean } }
  | { type: 'RESET_DAY' }
  | { type: 'FULL_LOGOUT_RESET' };

// ─── State ──────────────────────────────────────────────

export interface MissionsState {
  missions: Mission[];
  date: string;
  completedCount: number;
  /** XP earned today (resets each day). */
  dailyXP: number;
  /** Cumulative mission XP for the current global season (resets every 4 calendar months). */
  totalXP: number;
  lockedInToday: boolean;
  /** Weekly missions that persist across the week. */
  weeklyMissions: Mission[];
  /** ISO week key for current weekly missions. */
  weekKey: string;
}

/** Data available at session completion for auto-complete matching. */
export interface SessionCompleteData {
  durationMinutes: number;
  dailyFocusedMinutes: number;
  streak: number;
  dailyGoalMet: boolean;
}

interface MissionsContextType extends MissionsState {
  /** Global 4-month mission season index (1, 2, …), same for all users. */
  missionSeasonNumber: number;
  missionSeasonLabel: string;
  completeMission: (missionId: string) => void;
  generateDailyMissions: (goal: string) => void;
  /** Regenerate today's 3 missions (optional overrides for immediate post-settings update). */
  regenerateTodaysMissions: (override?: { goal?: string; weaknesses?: string[] }) => void;
  resetDay: () => void;
  /** Auto-complete eligible missions after a focus session finishes. */
  checkAutoComplete: (data: SessionCompleteData) => void;
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
const KEY_DAILY_PROFILE = '@lockedin/daily_missions_profile';
const KEY_CUMULATIVE_XP = '@lockedin/cumulative_xp';
const KEY_WEEKLY_MISSIONS = '@lockedin/weekly_missions';
const KEY_WEEKLY_WEEK = '@lockedin/weekly_missions_week';
const KEY_WEEKLY_PROFILE = '@lockedin/weekly_missions_profile';

/** Bust AsyncStorage cache when primary goal or focus areas change. */
const buildMissionsProfileKey = (goal: string, weaknesses: string[]): string =>
  `${goal}::${[...weaknesses].sort().join('|')}`;
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

    case 'UPDATE_DAILY_PROGRESS': {
      const updatedDaily = state.missions.map((m) => {
        if (m.id !== action.payload.missionId || m.completed) return m;
        return {
          ...m,
          progress: Math.min(action.payload.progress, action.payload.progressTarget),
          progressTarget: action.payload.progressTarget,
        };
      });
      return { ...state, missions: updatedDaily };
    }

    case 'SET_WEEKLY_MISSIONS':
      return {
        ...state,
        weeklyMissions: action.payload.weeklyMissions,
        weekKey: action.payload.weekKey,
      };

    case 'APPEND_WEEKLY_MISSION': {
      if (state.weeklyMissions.length >= MAX_WEEKLY_CHALLENGES) return state;
      if (state.weeklyMissions.some((m) => m.id === action.payload.id)) return state;
      if (state.weeklyMissions.some((m) => m.title === action.payload.title)) return state;
      return {
        ...state,
        weeklyMissions: [...state.weeklyMissions, action.payload],
      };
    }

    case 'UPDATE_WEEKLY_PROGRESS': {
      const { remainingDays, todayCounted } = action.payload;
      let xpGained = 0;
      const updatedWeekly = state.weeklyMissions.map((m) => {
        if (m.id !== action.payload.missionId) return m;
        if (m.completed || m.failed) return m;
        const newProgress = action.payload.progress;
        const completed = m.progressTarget != null && newProgress >= m.progressTarget;
        // remaining counts days AFTER today. Add 1 for today only if
        // today hasn't already been counted in progress.
        const possibleDays = newProgress + remainingDays + (todayCounted ? 0 : 1);
        const failed = !completed && m.progressTarget != null && possibleDays < m.progressTarget;
        if (completed) xpGained = m.xp;
        return { ...m, progress: newProgress, completed, failed };
      });
      return { ...state, weeklyMissions: updatedWeekly, totalXP: state.totalXP + xpGained };
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

const persistMissions = async (missions: Mission[], date: string, profile: string) => {
  await Promise.all([
    AsyncStorage.setItem(KEY_MISSIONS, JSON.stringify(missions)),
    AsyncStorage.setItem(KEY_DATE, date),
    AsyncStorage.setItem(KEY_DAILY_PROFILE, profile),
  ]);
};

const persistCumulativeXP = async (xp: number) => {
  await AsyncStorage.setItem(KEY_CUMULATIVE_XP, String(xp));
};

const persistWeeklyMissions = async (missions: Mission[], weekKey: string, profile: string) => {
  await Promise.all([
    AsyncStorage.setItem(KEY_WEEKLY_MISSIONS, JSON.stringify(missions)),
    AsyncStorage.setItem(KEY_WEEKLY_WEEK, weekKey),
    AsyncStorage.setItem(KEY_WEEKLY_PROFILE, profile),
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

/** Get count of active days this week and whether today is included. */
const getActiveDaysInfo = async (): Promise<{ count: number; todayCounted: boolean }> => {
  try {
    const weekKey = getMissionWeekKey();
    const raw = await AsyncStorage.getItem(KEY_ACTIVE_DAYS);
    if (!raw) return { count: 0, todayCounted: false };
    const stored = JSON.parse(raw) as { weekKey: string; days: string[] };
    if (stored.weekKey !== weekKey) return { count: 0, todayCounted: false };
    return { count: stored.days.length, todayCounted: stored.days.includes(getLocalDateString()) };
  } catch { return { count: 0, todayCounted: false }; }
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

/** Get count of early opens this week and whether today is included. */
const getEarlyOpensInfo = async (): Promise<{ count: number; todayCounted: boolean }> => {
  try {
    const weekKey = getMissionWeekKey();
    const raw = await AsyncStorage.getItem(KEY_EARLY_OPENS);
    if (!raw) return { count: 0, todayCounted: false };
    const stored = JSON.parse(raw) as { weekKey: string; days: string[] };
    if (stored.weekKey !== weekKey) return { count: 0, todayCounted: false };
    return { count: stored.days.length, todayCounted: stored.days.includes(getLocalDateString()) };
  } catch { return { count: 0, todayCounted: false }; }
};

const loadCumulativeXP = async (): Promise<number> => {
  const raw = await AsyncStorage.getItem(KEY_CUMULATIVE_XP);
  return raw ? parseInt(raw, 10) || 0 : 0;
};

/** Aligns stored XP with the current global mission season; resets XP when the season advances. */
const loadSeasonAwareCumulativeXP = async (): Promise<number> => {
  const current = String(getMissionSeasonNumber());
  const [rawXpStr, storedSeason] = await Promise.all([
    AsyncStorage.getItem(KEY_CUMULATIVE_XP),
    AsyncStorage.getItem(KEY_MISSION_XP_SEASON),
  ]);
  const rawXp = rawXpStr ? parseInt(rawXpStr, 10) || 0 : 0;

  if (storedSeason === null) {
    await AsyncStorage.setItem(KEY_MISSION_XP_SEASON, current);
    return rawXp;
  }

  if (storedSeason !== current) {
    await AsyncStorage.multiSet([
      [KEY_MISSION_XP_SEASON, current],
      [KEY_CUMULATIVE_XP, '0'],
    ]);
    return 0;
  }

  return rawXp;
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
  const lastMissionSeasonHydrated = useRef(getMissionSeasonNumber());

  // Stable key for userWeaknesses to avoid re-creating callbacks on every render
  const weaknessesKey = userWeaknesses.join(',');
  const stableWeaknesses = useMemo(() => userWeaknesses, [weaknessesKey]);

  const hydrate = useCallback(async () => {
    const expectedProfile = buildMissionsProfileKey(userGoal, stableWeaknesses);

    try {
      const [storedMissions, storedDate, storedDailyProfile, cumulativeXP] = await Promise.all([
        AsyncStorage.getItem(KEY_MISSIONS),
        AsyncStorage.getItem(KEY_DATE),
        AsyncStorage.getItem(KEY_DAILY_PROFILE),
        loadSeasonAwareCumulativeXP(),
      ]);

      const today = getLocalDateString();

      const canUseStoredDaily =
        !!storedMissions &&
        storedDate === today &&
        (storedDailyProfile === expectedProfile ||
          // Legacy installs: no profile yet — trust today's bundle once, then stamp profile.
          storedDailyProfile == null);

      if (canUseStoredDaily && storedMissions) {
        const missions = JSON.parse(storedMissions) as Mission[];
        const completedCount = getCompletedCount(missions);
        const dailyXP = calculateTotalXP(missions.filter((m) => m.completed));

        if (storedDailyProfile == null) {
          await AsyncStorage.setItem(KEY_DAILY_PROFILE, expectedProfile);
        }

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

        await persistMissions(newMissions, today, expectedProfile);
      }

      // ── Weekly missions hydration ──
      const currentWeekKey = getMissionWeekKey();
      const [storedWeekly, storedWeekKey, storedWeeklyProfile] = await Promise.all([
        AsyncStorage.getItem(KEY_WEEKLY_MISSIONS),
        AsyncStorage.getItem(KEY_WEEKLY_WEEK),
        AsyncStorage.getItem(KEY_WEEKLY_PROFILE),
      ]);

      const canUseStoredWeekly =
        !!storedWeekly &&
        storedWeekKey === currentWeekKey &&
        (storedWeeklyProfile === expectedProfile || storedWeeklyProfile == null);

      if (canUseStoredWeekly && storedWeekly) {
        const weeklyMissions = normalizeWeeklyMissions(JSON.parse(storedWeekly) as Mission[]);
        if (storedWeeklyProfile == null) {
          await AsyncStorage.setItem(KEY_WEEKLY_PROFILE, expectedProfile);
        }
        dispatch({ type: 'SET_WEEKLY_MISSIONS', payload: { weeklyMissions, weekKey: currentWeekKey } });
      } else {
        const newWeekly = normalizeWeeklyMissions(
          generateWeeklyMissions({
            goal: userGoal,
            weaknesses: stableWeaknesses,
            onboardingDate,
            streak,
          }),
        );
        dispatch({ type: 'SET_WEEKLY_MISSIONS', payload: { weeklyMissions: newWeekly, weekKey: currentWeekKey } });
        await persistWeeklyMissions(newWeekly, currentWeekKey, expectedProfile);
      }
    } catch (error) {
      console.error('[MissionsProvider] Hydration failed:', error);
      let cumulativeXP = 0;
      try {
        cumulativeXP = await loadSeasonAwareCumulativeXP();
      } catch {
        /* keep 0 */
      }
      const newMissions = generateDailyMissions({
        goal: userGoal,
        weaknesses: stableWeaknesses,
        onboardingDate,
        streak,
      });
      const today = getLocalDateString();
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
      void persistMissions(newMissions, today, expectedProfile);
    } finally {
      lastMissionSeasonHydrated.current = getMissionSeasonNumber();
    }
  }, [userGoal, stableWeaknesses, onboardingDate, streak]);

  // Discipline Board: count days where all daily + weekly missions were completed (season Locked In rule).
  useEffect(() => {
    const dailyAll =
      state.missions.length >= 3 &&
      getCompletedCount(state.missions) === state.missions.length;
    const weeklyOk =
      state.weeklyMissions.length === 0 ||
      state.weeklyMissions.every((m) => !m.failed);
    if (dailyAll && weeklyOk) {
      void recordPerfectMissionDay(getLocalDateString());
    }
  }, [state.missions, state.weeklyMissions]);

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
        const seasonNow = getMissionSeasonNumber();
        if (
          today !== state.date ||
          currentWeekKey !== state.weekKey ||
          seasonNow !== lastMissionSeasonHydrated.current
        ) {
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
      const profile = buildMissionsProfileKey(userGoal, stableWeaknesses);
      persistMissions(state.missions, state.date, profile).catch(() => {});
    }
  }, [state.missions, state.date, userGoal, stableWeaknesses]);

  // Persist cumulative XP on change (including 0 after a season reset)
  useEffect(() => {
    persistCumulativeXP(state.totalXP).catch(() => {});
  }, [state.totalXP]);

  // Persist weekly missions on change
  useEffect(() => {
    if (state.weeklyMissions.length > 0) {
      const profile = buildMissionsProfileKey(userGoal, stableWeaknesses);
      persistWeeklyMissions(state.weeklyMissions, state.weekKey, profile).catch(() => {});
    }
  }, [state.weeklyMissions, state.weekKey, userGoal, stableWeaknesses]);

  // Single failed weekly → append replacement (max 2: missed + new challenge)
  useEffect(() => {
    const list = state.weeklyMissions;
    if (list.length !== 1) return;
    const m = list[0];
    if (!m.failed || m.completed) return;
    const rep = generateWeeklyReplacementMission(
      { goal: userGoal, weaknesses: stableWeaknesses, onboardingDate, streak },
      [m.title],
    );
    if (!rep) return;
    dispatch({ type: 'APPEND_WEEKLY_MISSION', payload: rep });
  }, [state.weeklyMissions, userGoal, stableWeaknesses, onboardingDate, streak]);

  // Update weekly mission progress on app foreground and daily hydration
  const updateWeeklyProgress = useCallback(async () => {
    if (state.weeklyMissions.length === 0) return;

    for (const m of state.weeklyMissions) {
      if (m.completed || !m.progressMetric || m.progressTarget == null) continue;

      let progress = 0;
      let todayCounted = false;
      switch (m.progressMetric) {
        case 'days_active': {
          const info = await getActiveDaysInfo();
          progress = info.count;
          todayCounted = info.todayCounted;
          break;
        }
        case 'first_open_before_9am': {
          const info = await getEarlyOpensInfo();
          progress = info.count;
          todayCounted = info.todayCounted;
          break;
        }
        default:
          continue;
      }

      // Check if dispatch would actually change anything before dispatching
      const currentProgress = m.progress ?? 0;
      const remaining = getRemainingDaysInWeek();
      const wouldComplete = m.progressTarget != null && progress >= m.progressTarget;
      const possibleDays = progress + remaining + (todayCounted ? 0 : 1);
      const wouldFail = !wouldComplete && m.progressTarget != null && possibleDays < m.progressTarget;

      if (progress !== currentProgress || wouldFail !== (m.failed ?? false) || wouldComplete !== m.completed) {
        dispatch({ type: 'UPDATE_WEEKLY_PROGRESS', payload: { missionId: m.id, progress, remainingDays: remaining, todayCounted } });
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
        mission_difficulty: mission.difficulty,
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
    const profile = buildMissionsProfileKey(goal, stableWeaknesses);
    dispatch({ type: 'GENERATE_DAILY', payload: { missions: newMissions, date: today } });
    void persistMissions(newMissions, today, profile);
  };

  const regenerateTodaysMissions = useCallback(
    (override?: { goal?: string; weaknesses?: string[] }) => {
      const g = override?.goal ?? userGoal;
      const w = override?.weaknesses ?? stableWeaknesses;
      const profile = buildMissionsProfileKey(g, w);

      const newMissions = generateDailyMissions({
        goal: g,
        weaknesses: w,
        onboardingDate,
        streak,
      });
      const today = getLocalDateString();
      dispatch({ type: 'GENERATE_DAILY', payload: { missions: newMissions, date: today } });

      // Only regenerate weekly missions if the week has changed; preserve
      // mid-week progress when the user updates their goal or weaknesses.
      const currentWeekKey = getMissionWeekKey();
      if (state.weekKey !== currentWeekKey || state.weeklyMissions.length === 0) {
        const newWeekly = normalizeWeeklyMissions(
          generateWeeklyMissions({
            goal: g,
            weaknesses: w,
            onboardingDate,
            streak,
          }),
        );
        dispatch({ type: 'SET_WEEKLY_MISSIONS', payload: { weeklyMissions: newWeekly, weekKey: currentWeekKey } });
        void persistWeeklyMissions(newWeekly, currentWeekKey, profile);
      }

      void persistMissions(newMissions, today, profile);
    },
    [userGoal, stableWeaknesses, onboardingDate, streak],
  );

  const resetDay = () => {
    dispatch({ type: 'RESET_DAY' });
  };

  /**
   * Parse a minimum duration (in minutes) from the variant portion of a
   * core mission description.  Descriptions are formatted as:
   *   "Complete a focus session before 10 AM — 30-min session"
   * We split on " — " and parse from the variant suffix only, so numbers
   * in the base description (e.g. "10 AM") don't interfere.
   */
  const parseMinutesFromDescription = (desc: string): number => {
    const parts = desc.split(' — ');
    const variant = parts.length > 1 ? parts[parts.length - 1] : desc;
    const m = variant.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };

  /**
   * Check uncompleted auto-type missions against session data and complete any that match.
   * Called from SessionCompleteScreen after a focus session finishes.
   */
  const checkAutoComplete = (data: SessionCompleteData) => {
    const hour = new Date().getHours();

    for (const mission of state.missions) {
      if (mission.completed || mission.completionType !== 'auto') continue;

      const required = parseMinutesFromDescription(mission.description);
      // Current progress and target for this mission — null means no progress tracking
      let progress: number | null = null;
      let target: number | null = null;
      let shouldComplete = false;

      switch (mission.title) {
        case 'Morning Focus Sprint':
          if (hour < 10) {
            target = required;
            progress = data.durationMinutes;
            shouldComplete = progress >= target;
          }
          break;
        case 'Deep Work Block':
          target = required;
          progress = data.durationMinutes;
          shouldComplete = progress >= target;
          break;
        case 'Afternoon Lock In':
          if (hour >= 12 && hour < 17) {
            target = required;
            progress = data.durationMinutes;
            shouldComplete = progress >= target;
          }
          break;
        case 'Evening Focus Session':
          if (hour >= 17 && hour < 21) {
            target = required;
            progress = data.durationMinutes;
            shouldComplete = progress >= target;
          }
          break;
        case 'Focus Marathon':
          target = required;
          progress = data.dailyFocusedMinutes;
          shouldComplete = progress >= target;
          break;
        case 'Hit Your Daily Goal':
          shouldComplete = data.dailyGoalMet;
          break;
        case 'Double Lock In': {
          const descParts = mission.description.split(' — ');
          const variant = descParts.length > 1 ? descParts[descParts.length - 1] : '';
          const mul = variant.match(/(\d+)\s*×\s*(\d+)/);
          const totalRequired = mul ? parseInt(mul[1], 10) * parseInt(mul[2], 10) : 0;
          if (totalRequired > 0) {
            target = totalRequired;
            progress = data.dailyFocusedMinutes;
            shouldComplete = progress >= target;
          }
          break;
        }
        case 'Streak Builder':
          if (required > 0) {
            target = required;
            progress = data.durationMinutes;
            shouldComplete = progress >= target;
          } else {
            // Easy variant: "Any session today" — complete immediately
            shouldComplete = true;
          }
          break;
        // First Thing Focus, Distraction-Free Hour — left as manual tap-to-complete.
        default:
          break;
      }

      // Update progress on the mission so the UI shows e.g. "25/45 min"
      if (target != null && progress != null) {
        dispatch({ type: 'UPDATE_DAILY_PROGRESS', payload: { missionId: mission.id, progress, progressTarget: target } });
      }

      if (shouldComplete) {
        completeMission(mission.id);
      }
    }
  };

  const contextValue: MissionsContextType = useMemo(() => ({
    ...state,
    missionSeasonNumber: getMissionSeasonNumber(),
    missionSeasonLabel: getMissionSeasonLabel(),
    completeMission,
    generateDailyMissions: generateDailyMissionsAction,
    regenerateTodaysMissions,
    resetDay,
    checkAutoComplete,
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
