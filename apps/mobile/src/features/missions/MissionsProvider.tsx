/**
 * MissionsProvider.tsx
 * Context provider for daily missions with AsyncStorage persistence
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Mission, getMissionsForGoal, getCompletedCount, calculateTotalXP } from './MissionEngine';

// Action types
type MissionAction =
  | { type: 'HYDRATE'; payload: MissionsState }
  | { type: 'GENERATE_DAILY'; payload: { missions: Mission[]; date: string } }
  | { type: 'COMPLETE_MISSION'; payload: string }
  | { type: 'RESET_DAY' };

// State interface
export interface MissionsState {
  missions: Mission[];
  date: string; // ISO date string
  completedCount: number;
  totalXP: number;
  lockedInToday: boolean;
}

// Context interface
interface MissionsContextType extends MissionsState {
  completeMission: (missionId: string) => void;
  generateDailyMissions: (goal: string) => void;
  resetDay: () => void;
}

// Create context
const MissionsContext = createContext<MissionsContextType | undefined>(undefined);

// Initial state
const getInitialState = (): MissionsState => ({
  missions: [],
  date: new Date().toISOString().split('T')[0],
  completedCount: 0,
  totalXP: 0,
  lockedInToday: false,
});

/**
 * Reducer for missions state management
 */
const missionsReducer = (state: MissionsState, action: MissionAction): MissionsState => {
  switch (action.type) {
    case 'HYDRATE': {
      return action.payload;
    }

    case 'GENERATE_DAILY': {
      const completedCount = getCompletedCount(action.payload.missions);
      const totalXP = calculateTotalXP(action.payload.missions.filter(m => m.completed));
      return {
        missions: action.payload.missions,
        date: action.payload.date,
        completedCount,
        totalXP,
        lockedInToday: completedCount === 3,
      };
    }

    case 'COMPLETE_MISSION': {
      const updatedMissions = state.missions.map(mission =>
        mission.id === action.payload
          ? { ...mission, completed: true }
          : mission
      );

      const completedCount = getCompletedCount(updatedMissions);
      const totalXP = calculateTotalXP(updatedMissions.filter(m => m.completed));

      return {
        ...state,
        missions: updatedMissions,
        completedCount,
        totalXP,
        lockedInToday: completedCount === 3,
      };
    }

    case 'RESET_DAY': {
      const newDate = new Date().toISOString().split('T')[0];
      return {
        missions: [],
        date: newDate,
        completedCount: 0,
        totalXP: 0,
        lockedInToday: false,
      };
    }

    default:
      return state;
  }
};

// Storage keys
const STORAGE_KEY = '@lockedin/daily_missions';
const STORAGE_KEY_DATE = '@lockedin/daily_missions_date';

/**
 * MissionsProvider component
 */
export const MissionsProvider = ({ children, userGoal }: { children: ReactNode; userGoal: string }) => {
  const [state, dispatch] = useReducer(missionsReducer, getInitialState());

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    const hydrate = async () => {
      try {
        const [storedMissions, storedDate] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(STORAGE_KEY_DATE),
        ]);

        const today = new Date().toISOString().split('T')[0];

        // Check if stored missions are for today
        if (storedMissions && storedDate === today) {
          const missions = JSON.parse(storedMissions) as Mission[];
          dispatch({
            type: 'HYDRATE',
            payload: {
              missions,
              date: today,
              completedCount: getCompletedCount(missions),
              totalXP: calculateTotalXP(missions.filter(m => m.completed)),
              lockedInToday: getCompletedCount(missions) === 3,
            },
          });
        } else {
          // Missions are stale or don't exist, generate new ones
          const newMissions = getMissionsForGoal(userGoal);
          dispatch({
            type: 'GENERATE_DAILY',
            payload: {
              missions: newMissions,
              date: today,
            },
          });
          // Persist new missions
          await persistMissions(newMissions, today);
        }
      } catch (error) {
        console.error('Failed to hydrate missions:', error);
        // If hydration fails, generate fresh missions
        const newMissions = getMissionsForGoal(userGoal);
        const today = new Date().toISOString().split('T')[0];
        dispatch({
          type: 'GENERATE_DAILY',
          payload: {
            missions: newMissions,
            date: today,
          },
        });
      }
    };

    hydrate();
  }, [userGoal]);

  // Persist missions whenever state changes
  useEffect(() => {
    if (state.missions.length > 0) {
      persistMissions(state.missions, state.date).catch(error =>
        console.error('Failed to persist missions:', error)
      );
    }
  }, [state.missions, state.date]);

  const completeMission = (missionId: string) => {
    dispatch({ type: 'COMPLETE_MISSION', payload: missionId });
  };

  const generateDailyMissions = (goal: string) => {
    const newMissions = getMissionsForGoal(goal);
    const today = new Date().toISOString().split('T')[0];
    dispatch({
      type: 'GENERATE_DAILY',
      payload: {
        missions: newMissions,
        date: today,
      },
    });
  };

  const resetDay = () => {
    dispatch({ type: 'RESET_DAY' });
  };

  const contextValue: MissionsContextType = {
    ...state,
    completeMission,
    generateDailyMissions,
    resetDay,
  };

  return (
    <MissionsContext.Provider value={contextValue}>
      {children}
    </MissionsContext.Provider>
  );
};

/**
 * Hook to use missions context
 */
export const useMissions = (): MissionsContextType => {
  const context = useContext(MissionsContext);
  if (!context) {
    throw new Error('useMissions must be used within a MissionsProvider');
  }
  return context;
};

/**
 * Helper function to persist missions to AsyncStorage
 */
const persistMissions = async (missions: Mission[], date: string): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(missions)),
      AsyncStorage.setItem(STORAGE_KEY_DATE, date),
    ]);
  } catch (error) {
    console.error('Failed to persist missions to storage:', error);
    throw error;
  }
};
