/**
 * MissionsProvider.tsx
 * Context provider for the 3-slot daily mission system with AsyncStorage persistence
 * and cumulative XP tracking.
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Mission,
  generateDailyMissions,
  getCompletedCount,
  calculateTotalXP,
} from './MissionEngine';
import { CrewService } from '../leaderboard/CrewService';

// ─── Action types ───────────────────────────────────────

type MissionAction =
  | { type: 'HYDRATE'; payload: MissionsState }
  | { type: 'GENERATE_DAILY'; payload: { missions: Mission[]; date: string } }
  | { type: 'COMPLETE_MISSION'; payload: string }
  | { type: 'RESET_DAY' };

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
}

interface MissionsContextType extends MissionsState {
  completeMission: (missionId: string) => void;
  generateDailyMissions: (goal: string) => void;
  resetDay: () => void;
}

const MissionsContext = createContext<MissionsContextType | undefined>(undefined);

const getInitialState = (): MissionsState => ({
  missions: [],
  date: new Date().toISOString().split('T')[0],
  completedCount: 0,
  dailyXP: 0,
  totalXP: 0,
  lockedInToday: false,
});

// ─── Storage keys ───────────────────────────────────────

const KEY_MISSIONS = '@lockedin/daily_missions';
const KEY_DATE = '@lockedin/daily_missions_date';
const KEY_CUMULATIVE_XP = '@lockedin/cumulative_xp';

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

    case 'RESET_DAY':
      return {
        ...state,
        missions: [],
        date: new Date().toISOString().split('T')[0],
        completedCount: 0,
        dailyXP: 0,
        lockedInToday: false,
      };

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

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [storedMissions, storedDate, cumulativeXP] = await Promise.all([
          AsyncStorage.getItem(KEY_MISSIONS),
          AsyncStorage.getItem(KEY_DATE),
          loadCumulativeXP(),
        ]);

        const today = new Date().toISOString().split('T')[0];

        if (storedMissions && storedDate === today) {
          const missions = JSON.parse(storedMissions) as Mission[];
          const completedCount = getCompletedCount(missions);
          const dailyXP = calculateTotalXP(missions.filter((m) => m.completed));

          dispatch({
            type: 'HYDRATE',
            payload: {
              missions,
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
            weaknesses: userWeaknesses,
            onboardingDate,
            streak,
          });

          dispatch({
            type: 'HYDRATE',
            payload: {
              missions: newMissions,
              date: today,
              completedCount: 0,
              dailyXP: 0,
              totalXP: cumulativeXP,
              lockedInToday: false,
            },
          });

          await persistMissions(newMissions, today);
        }
      } catch (error) {
        console.error('[MissionsProvider] Hydration failed:', error);
        const newMissions = generateDailyMissions({
          goal: userGoal,
          weaknesses: userWeaknesses,
          onboardingDate,
          streak,
        });
        const today = new Date().toISOString().split('T')[0];
        dispatch({
          type: 'GENERATE_DAILY',
          payload: { missions: newMissions, date: today },
        });
      }
    };

    hydrate();
  }, [userGoal, userWeaknesses, onboardingDate, streak]);

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

  const completeMission = (missionId: string) => {
    dispatch({ type: 'COMPLETE_MISSION', payload: missionId });

    (async () => {
      try {
        const stats = await CrewService.getWeeklyStats();
        const updated = { missions_done: stats.missions_done + 1 };
        await CrewService.updateWeeklyStats(updated);
        const latest = await CrewService.getWeeklyStats();
        await CrewService.submitScoreToAllCrews(
          latest.focus_minutes,
          latest.missions_done,
          latest.streak_days,
        );
      } catch (e) {
        console.error('[MissionsProvider] Crew score submission failed:', e);
      }
    })();
  };

  const generateDailyMissionsAction = (goal: string) => {
    const newMissions = generateDailyMissions({
      goal,
      weaknesses: userWeaknesses,
      onboardingDate,
      streak,
    });
    const today = new Date().toISOString().split('T')[0];
    dispatch({ type: 'GENERATE_DAILY', payload: { missions: newMissions, date: today } });
  };

  const resetDay = () => {
    dispatch({ type: 'RESET_DAY' });
  };

  const contextValue: MissionsContextType = {
    ...state,
    completeMission,
    generateDailyMissions: generateDailyMissionsAction,
    resetDay,
  };

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
