/**
 * useOnboardingTracking — Centralised per-screen analytics for onboarding.
 *
 * Fires:
 *  • "Onboarding Screen Viewed"  on mount (with step, total_steps, screen name)
 *  • "Onboarding Screen Exited"  on unmount (with time_on_screen_ms)
 *  • Persists currentScreen to AsyncStorage so the flow can resume on restart
 *
 * Usage:
 *   useOnboardingTracking('PhoneTimeQuiz', 2);
 */

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MixpanelService } from '../../../services/MixpanelService';

const TOTAL_STEPS = 11;
const CURRENT_SCREEN_KEY = '@lockedin/onboarding_current_screen';

export type OnboardingScreenName =
  | 'Definition'
  | 'PhoneTimeQuiz'
  | 'AgeQuiz'
  | 'LossAversionStat'
  | 'GoalQuiz'
  | 'ControlQuiz'
  | 'DailyTimeCommitment'
  | 'ScreenTimePreFrame'
  | 'NotificationPreFrame'
  | 'PersonalizedPlanCard'
  | 'AccountPrompt';

/**
 * Map screen names to their step number in the new 10-screen flow.
 */
export const SCREEN_STEP_MAP: Record<OnboardingScreenName, number> = {
  Definition: 1,
  PhoneTimeQuiz: 2,
  AgeQuiz: 3,
  LossAversionStat: 4,
  GoalQuiz: 5,
  ControlQuiz: 6,
  DailyTimeCommitment: 7,
  ScreenTimePreFrame: 8,
  NotificationPreFrame: 9,
  PersonalizedPlanCard: 10,
  AccountPrompt: 11,
};

/**
 * Ordered list of screen names for resume logic.
 */
export const ONBOARDING_SCREEN_ORDER: OnboardingScreenName[] = [
  'Definition',
  'PhoneTimeQuiz',
  'AgeQuiz',
  'LossAversionStat',
  'GoalQuiz',
  'ControlQuiz',
  'DailyTimeCommitment',
  'ScreenTimePreFrame',
  'NotificationPreFrame',
  'PersonalizedPlanCard',
  'AccountPrompt',
];

export function useOnboardingTracking(screen: OnboardingScreenName, step?: number): void {
  const mountTime = useRef(Date.now());
  const resolvedStep = step ?? SCREEN_STEP_MAP[screen];

  useEffect(() => {
    mountTime.current = Date.now();

    // Fire screen viewed event
    MixpanelService.track('Onboarding Screen Viewed', {
      screen,
      step: resolvedStep,
      total_steps: TOTAL_STEPS,
    });

    // Start Mixpanel timed event for this screen
    MixpanelService.timeEvent('Onboarding Screen Exited');

    // Persist current screen for resume-on-restart
    AsyncStorage.setItem(CURRENT_SCREEN_KEY, screen).catch(() => {});

    return () => {
      const duration = Date.now() - mountTime.current;
      MixpanelService.track('Onboarding Screen Exited', {
        screen,
        step: resolvedStep,
        total_steps: TOTAL_STEPS,
        time_on_screen_ms: duration,
      });
    };
  }, [screen, resolvedStep]);
}

/**
 * Read the persisted current screen for resume logic.
 * Returns null if no screen was persisted.
 */
export async function getPersistedOnboardingScreen(): Promise<OnboardingScreenName | null> {
  try {
    const raw = await AsyncStorage.getItem(CURRENT_SCREEN_KEY);
    if (raw && ONBOARDING_SCREEN_ORDER.includes(raw as OnboardingScreenName)) {
      return raw as OnboardingScreenName;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear persisted screen (call when onboarding completes).
 */
export async function clearPersistedOnboardingScreen(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CURRENT_SCREEN_KEY);
  } catch {}
}
