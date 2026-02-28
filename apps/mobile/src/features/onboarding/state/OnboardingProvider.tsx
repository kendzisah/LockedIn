import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingState, OnboardingAction } from './types';

const STORAGE_KEY = '@lockedin/onboarding_complete';

const initialState: OnboardingState = {
  selectedPainPoint: null,
  phoneUsageHours: null,
  dailyDedication: null,
  selectedGoals: [],
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
    case 'SET_PAIN_POINT':
      return { ...state, selectedPainPoint: action.payload };
    case 'SET_PHONE_USAGE':
      return { ...state, phoneUsageHours: action.payload };
    case 'SET_DAILY_DEDICATION':
      return { ...state, dailyDedication: action.payload };
    case 'SET_GOALS':
      return { ...state, selectedGoals: action.payload };
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

  // ── Load persisted onboarding flag on mount ──
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw === 'true') {
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
    }
    prevComplete.current = state.onboardingComplete;
  }, [state.onboardingComplete]);

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
