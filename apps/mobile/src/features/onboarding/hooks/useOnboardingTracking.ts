/**
 * useOnboardingTracking — Centralised per-screen analytics for onboarding.
 *
 * Fires:
 *  • "Onboarding Screen Viewed"  on mount (with step, total_steps, screen name)
 *  • "Onboarding Screen Exited"  on unmount (with time_on_screen_ms)
 *  • Persists currentScreen to AsyncStorage so the flow can resume on restart
 *
 * Usage:
 *   useOnboardingTracking('PhoneTimeQuiz');
 */

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Analytics } from '../../../services/AnalyticsService';

export const TOTAL_STEPS = 24;
const CURRENT_SCREEN_KEY = '@lockedin/onboarding_current_screen';

export type OnboardingScreenName =
  | 'Definition'
  | 'PhoneTimeQuiz'
  | 'LossAversionStat'
  | 'Reclaim'
  | 'AgeQuiz'
  | 'GoalQuiz'
  | 'ControlQuiz'
  | 'DailyTimeCommitment'
  | 'ControlLevel'
  | 'StatReveal'
  | 'Day90Preview'
  | 'VulnerableTime'
  | 'BenefitExecution'
  | 'BenefitMissions'
  | 'BenefitRanks'
  | 'BenefitGuilds'
  | 'BenefitReport'
  | 'ScreenTimePreFrame'
  | 'NotificationPreFrame'
  | 'AccountPrompt'
  | 'OnboardingAuth'
  | 'Commitment'
  | 'SocialProof'
  | 'TrialPreview'
  | 'Paywall';

/**
 * Map screen names to their step number in the 24-screen "system awakening" flow.
 */
export const SCREEN_STEP_MAP: Record<OnboardingScreenName, number> = {
  Definition: 1,
  PhoneTimeQuiz: 2,
  LossAversionStat: 3,
  Reclaim: 4,
  AgeQuiz: 5,
  GoalQuiz: 6,
  ControlQuiz: 7,
  DailyTimeCommitment: 8,
  ControlLevel: 9,
  StatReveal: 10,
  Day90Preview: 11,
  VulnerableTime: 12,
  BenefitExecution: 13,
  BenefitMissions: 14,
  BenefitRanks: 15,
  BenefitGuilds: 16,
  BenefitReport: 17,
  ScreenTimePreFrame: 18,
  NotificationPreFrame: 19,
  AccountPrompt: 20,
  // Auth form is a sub-screen of AccountPrompt — same step number so the
  // progress bar doesn't jump when users tap into it.
  OnboardingAuth: 20,
  Commitment: 21,
  SocialProof: 22,
  TrialPreview: 23,
  Paywall: 24,
};

/**
 * Ordered list of screen names for resume logic.
 */
export const ONBOARDING_SCREEN_ORDER: OnboardingScreenName[] = [
  'Definition',
  'PhoneTimeQuiz',
  'LossAversionStat',
  'Reclaim',
  'AgeQuiz',
  'GoalQuiz',
  'ControlQuiz',
  'DailyTimeCommitment',
  'ControlLevel',
  'StatReveal',
  'Day90Preview',
  'VulnerableTime',
  'BenefitExecution',
  'BenefitMissions',
  'BenefitRanks',
  'BenefitGuilds',
  'BenefitReport',
  'ScreenTimePreFrame',
  'NotificationPreFrame',
  'AccountPrompt',
  'Commitment',
  'SocialProof',
  'TrialPreview',
  'Paywall',
];

export function useOnboardingTracking(screen: OnboardingScreenName, step?: number): void {
  const mountTime = useRef(Date.now());
  const resolvedStep = step ?? SCREEN_STEP_MAP[screen];

  useEffect(() => {
    mountTime.current = Date.now();

    // Fire screen viewed event
    Analytics.track('Onboarding Screen Viewed', {
      screen,
      step: resolvedStep,
      total_steps: TOTAL_STEPS,
    });

    // Start Mixpanel timed event for this screen
    Analytics.timeEvent('Onboarding Screen Exited');

    // Persist current screen for resume-on-restart
    AsyncStorage.setItem(CURRENT_SCREEN_KEY, screen).catch(() => {});

    return () => {
      const duration = Date.now() - mountTime.current;
      Analytics.track('Onboarding Screen Exited', {
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
