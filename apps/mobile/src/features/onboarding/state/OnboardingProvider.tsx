import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingState, OnboardingAction } from './types';
import { Analytics } from '../../../services/AnalyticsService';
import { clearPersistedOnboardingScreen } from '../hooks/useOnboardingTracking';
import { subscribeLogoutCleanup } from '../../../services/logoutCleanupBus';

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
  onboardingCompletedAt: null,
  currentScreen: null,
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
      return { ...state, onboardingComplete: true, onboardingCompletedAt: state.onboardingCompletedAt ?? new Date().toISOString() };
    case 'SET_CURRENT_SCREEN':
      return { ...state, currentScreen: action.payload };
    case 'HYDRATE_STATE':
      return { ...state, ...action.payload };
    case 'FULL_RESET':
      return { ...initialState, onboardingComplete: false };
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
  // Use null to distinguish "not yet set" from "was false" — prevents completion
  // side-effects from re-firing on hydration cold starts.
  const prevComplete = useRef<boolean | null>(null);
  // Guard to block persistence while logout cleanup is in progress
  const isResetting = useRef(false);

  // ── Load persisted onboarding flag + data on mount (single dispatch) ──
  useEffect(() => {
    (async () => {
      try {
        const [flagRaw, dataRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(ONBOARDING_DATA_KEY),
        ]);
        const payload: Partial<OnboardingState> = {
          onboardingComplete: flagRaw === 'true',
        };
        if (dataRaw) {
          try {
            const data = JSON.parse(dataRaw);
            // Migrate legacy string dailyMinutes to number
            if (typeof data.dailyMinutes === 'string') {
              data.dailyMinutes = 60;
            }
            if (typeof data.dailyMinutes === 'number') payload.dailyMinutes = data.dailyMinutes;
            if (typeof data.primaryGoal === 'string') payload.primaryGoal = data.primaryGoal;
            if (typeof data.phoneUsageHours === 'string') payload.phoneUsageHours = data.phoneUsageHours;
            if (typeof data.userAge === 'number') payload.userAge = data.userAge;
            if (Array.isArray(data.selectedWeaknesses)) payload.selectedWeaknesses = data.selectedWeaknesses;
            if (typeof data.currentScreen === 'string') payload.currentScreen = data.currentScreen;
            if (typeof data.onboardingCompletedAt === 'string') payload.onboardingCompletedAt = data.onboardingCompletedAt;
          } catch {}
        }
        dispatch({ type: 'HYDRATE_STATE', payload });
      } catch (e) {
        console.warn('[OnboardingProvider] Hydration failed:', e);
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    return subscribeLogoutCleanup(() => {
      isResetting.current = true;
      dispatch({ type: 'FULL_RESET' });
      // Re-enable persistence after React processes the FULL_RESET render
      queueMicrotask(() => { isResetting.current = false; });
    });
  }, []);

  // ── Persist quiz answers incrementally so resume works ──
  useEffect(() => {
    if (!isHydrated) return; // Don't persist before hydration completes
    if (isResetting.current) return; // Don't re-persist during logout cleanup
    if (state.onboardingComplete) return; // Don't overwrite after completion
    AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify({
      dailyMinutes: state.dailyMinutes,
      primaryGoal: state.primaryGoal,
      phoneUsageHours: state.phoneUsageHours,
      userAge: state.userAge,
      selectedWeaknesses: state.selectedWeaknesses,
      currentScreen: state.currentScreen,
    })).catch(() => {});
  }, [isHydrated, state.dailyMinutes, state.primaryGoal, state.phoneUsageHours, state.userAge, state.selectedWeaknesses, state.currentScreen, state.onboardingComplete]);

  // ── After onboarding: keep goal / commitment / weaknesses in sync with AsyncStorage ──
  useEffect(() => {
    if (!isHydrated || !state.onboardingComplete) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
        const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        await AsyncStorage.setItem(
          ONBOARDING_DATA_KEY,
          JSON.stringify({
            ...prev,
            dailyMinutes: state.dailyMinutes,
            primaryGoal: state.primaryGoal,
            selectedWeaknesses: state.selectedWeaknesses,
            phoneUsageHours: state.phoneUsageHours,
            userAge: state.userAge,
          }),
        );
      } catch {
        /* ignore */
      }
    })();
  }, [
    isHydrated,
    state.onboardingComplete,
    state.dailyMinutes,
    state.primaryGoal,
    state.selectedWeaknesses,
    state.phoneUsageHours,
    state.userAge,
  ]);

  // ── Persist when onboardingComplete flips to true (skip hydration) ──
  useEffect(() => {
    if (prevComplete.current !== null && state.onboardingComplete && !prevComplete.current) {
      AsyncStorage.setItem(STORAGE_KEY, 'true').catch((e) => {
        console.warn('[OnboardingProvider] Persist failed:', e);
      });

      // Persist onboardingCompletedAt in the data key for MissionsProvider
      if (state.onboardingCompletedAt) {
        AsyncStorage.getItem(ONBOARDING_DATA_KEY).then((raw) => {
          const prev = raw ? JSON.parse(raw) : {};
          return AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify({ ...prev, onboardingCompletedAt: state.onboardingCompletedAt }));
        }).catch(() => {});
      }

      // Clear resume screen since onboarding is done
      clearPersistedOnboardingScreen().catch(() => {});

      Analytics.setUserProperties({
        age: state.userAge,
        primary_goal: state.primaryGoal,
        daily_commitment_minutes: state.dailyMinutes,
        phone_usage: state.phoneUsageHours,
        weaknesses: state.selectedWeaknesses.join(', '),
        screen_time_granted: state.screenTimeStatus === 'granted',
        notifications_granted: state.notificationsGranted ?? false,
        demo_completed: state.demoCompleted,
        platform: 'ios',
      });
      Analytics.setUserPropertiesOnce({
        onboarding_completed_at: new Date().toISOString(),
      });
    }
    prevComplete.current = state.onboardingComplete;
  }, [state.onboardingComplete, state.userAge, state.primaryGoal, state.dailyMinutes, state.phoneUsageHours, state.selectedWeaknesses, state.screenTimeStatus, state.notificationsGranted, state.demoCompleted]);

  const contextValue = useMemo(
    () => ({ state, dispatch, isHydrated }),
    [state, isHydrated],
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
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
