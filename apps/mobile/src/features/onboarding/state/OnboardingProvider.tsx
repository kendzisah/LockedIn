import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingState, OnboardingAction } from './types';
import { MixpanelService } from '../../../services/MixpanelService';

const STORAGE_KEY = '@lockedin/onboarding_complete';
const ONBOARDING_DATA_KEY = '@lockedin/onboarding_data';

const initialState: OnboardingState = {
  selectedWeaknesses: [],
  phoneUsageHours: null,
  userAge: null,
  dailyMinutes: null,
  primaryGoal: null,
  screenTimeStatus: 'not_requested',
  notificationsGranted: null,
  demoCompleted: false,
  onboardingComplete: false,
};

function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case 'SET_WEAKNESSES':
      return { ...state, selectedWeaknesses: action.payload };
    case 'SET_PHONE_USAGE':
      return { ...state, phoneUsageHours: action.payload };
    case 'SET_USER_AGE':
      return { ...state, userAge: action.payload };
    case 'SET_DAILY_MINUTES':
      return { ...state, dailyMinutes: action.payload };
    case 'SET_PRIMARY_GOAL':
      return { ...state, primaryGoal: action.payload };
    case 'SET_SCREEN_TIME_STATUS':
      return { ...state, screenTimeStatus: action.payload };
    case 'SET_NOTIFICATIONS_GRANTED':
      return { ...state, notificationsGranted: action.payload };
    case 'SET_DEMO_COMPLETED':
      return { ...state, demoCompleted: true };
    case 'COMPLETE_ONBOARDING':
      return { ...state, onboardingComplete: true };
    case 'HYDRATE_ONBOARDING':
      return { ...state, onboardingComplete: action.payload };
    default:
      return state;
  }
}

interface OnboardingContextValue {
  state: OnboardingState;
  dispatch: React.Dispatch<OnboardingAction>;
  isHydrated: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(onboardingReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const prevComplete = useRef(state.onboardingComplete);

  // ── Load persisted onboarding flag + data on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [flagRaw, dataRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(ONBOARDING_DATA_KEY),
        ]);
        if (dataRaw) {
          try {
            const data = JSON.parse(dataRaw);
            // Migrate legacy string dailyMinutes to number
            if (typeof data.dailyMinutes === 'string') {
              data.dailyMinutes = 60;
            }
            if (typeof data.dailyMinutes === 'number') {
              dispatch({ type: 'SET_DAILY_MINUTES', payload: data.dailyMinutes });
            }
            if (typeof data.primaryGoal === 'string') {
              dispatch({ type: 'SET_PRIMARY_GOAL', payload: data.primaryGoal });
            }
          } catch {}
        }
        if (flagRaw === 'true') {
          dispatch({ type: 'HYDRATE_ONBOARDING', payload: true });
        }
      } catch (e) {
        console.warn('[OnboardingProvider] Hydration failed:', e);
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  // ── Persist when onboardingComplete flips to true ──
  useEffect(() => {
    if (state.onboardingComplete && !prevComplete.current) {
      AsyncStorage.setItem(STORAGE_KEY, 'true').catch((e) => {
        console.warn('[OnboardingProvider] Persist failed:', e);
      });

      AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify({
        dailyMinutes: state.dailyMinutes,
        primaryGoal: state.primaryGoal,
      })).catch(() => {});

      MixpanelService.setUserProperties({
        age: state.userAge,
        primary_goal: state.primaryGoal,
        daily_commitment_minutes: state.dailyMinutes,
        phone_usage: state.phoneUsageHours,
        weaknesses: state.selectedWeaknesses.join(', '),
        screen_time_granted: state.screenTimeStatus === 'granted',
        notifications_granted: state.notificationsGranted ?? false,
        demo_completed: state.demoCompleted,
      });
    }
    prevComplete.current = state.onboardingComplete;
  }, [state.onboardingComplete, state.userAge, state.primaryGoal, state.dailyMinutes, state.phoneUsageHours, state.selectedWeaknesses, state.screenTimeStatus, state.notificationsGranted, state.demoCompleted]);

  return (
    <OnboardingContext.Provider value={{ state, dispatch, isHydrated }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
}
