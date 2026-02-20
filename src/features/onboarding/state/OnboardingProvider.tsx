import React, { createContext, useContext, useReducer } from 'react';
import type { OnboardingState, OnboardingAction } from './types';

const initialState: OnboardingState = {
  selectedPainPoint: null,
  phoneUsageHours: null,
  dailyDedication: null,
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
    case 'SET_SCREEN_TIME_STATUS':
      return { ...state, screenTimeStatus: action.payload };
    case 'SET_NOTIFICATIONS_GRANTED':
      return { ...state, notificationsGranted: action.payload };
    case 'SET_DEMO_COMPLETED':
      return { ...state, demoCompleted: true };
    case 'COMPLETE_ONBOARDING':
      return { ...state, onboardingComplete: true };
    default:
      return state;
  }
}

interface OnboardingContextValue {
  state: OnboardingState;
  dispatch: React.Dispatch<OnboardingAction>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(onboardingReducer, initialState);

  return (
    <OnboardingContext.Provider value={{ state, dispatch }}>
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
