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

export const TOTAL_STEPS = 26;
const CURRENT_SCREEN_KEY = '@lockedin/onboarding_current_screen';

export type OnboardingScreenName =
  | 'Definition'
  | 'PhoneTimeQuiz'
  | 'WakeUpCall'
  | 'AgeQuiz'
  | 'Situation'
  | 'GoalQuiz'
  | 'ControlQuiz'
  | 'Triggers'
  | 'MorningRoutine'
  | 'DailyTimeCommitment'
  | 'WhyNow'
  | 'ControlLevel'
  | 'SystemAnalysis'
  | 'StatReveal'
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
  | 'ScheduleSession'
  | 'SocialProof'
  | 'Paywall';

/**
 * Map screen names to their step number in the 26-screen "system awakening" flow.
 */
export const SCREEN_STEP_MAP: Record<OnboardingScreenName, number> = {
  Definition: 1,
  PhoneTimeQuiz: 2,
  WakeUpCall: 3,
  AgeQuiz: 4,
  Situation: 5,
  GoalQuiz: 6,
  ControlQuiz: 7,
  Triggers: 8,
  MorningRoutine: 9,
  DailyTimeCommitment: 10,
  WhyNow: 11,
  ControlLevel: 12,
  SystemAnalysis: 13,
  StatReveal: 14,
  BenefitExecution: 15,
  BenefitMissions: 16,
  BenefitRanks: 17,
  BenefitGuilds: 18,
  BenefitReport: 19,
  ScreenTimePreFrame: 20,
  NotificationPreFrame: 21,
  AccountPrompt: 22,
  // Auth form is a sub-screen of AccountPrompt — same step number so the
  // progress bar doesn't jump when users tap into it.
  OnboardingAuth: 22,
  Commitment: 23,
  ScheduleSession: 24,
  SocialProof: 25,
  Paywall: 26,
};

/**
 * Ordered list of screen names for resume logic.
 *
 * Retired screen names are deliberately excluded — if a user's persisted
 * `currentScreen` is a retired route, `getPersistedOnboardingScreen` returns
 * null and the navigator falls back to `Definition`.
 */
export const ONBOARDING_SCREEN_ORDER: OnboardingScreenName[] = [
  'Definition',
  'PhoneTimeQuiz',
  'WakeUpCall',
  'AgeQuiz',
  'Situation',
  'GoalQuiz',
  'ControlQuiz',
  'Triggers',
  'MorningRoutine',
  'DailyTimeCommitment',
  'WhyNow',
  'ControlLevel',
  'SystemAnalysis',
  'StatReveal',
  'BenefitExecution',
  'BenefitMissions',
  'BenefitRanks',
  'BenefitGuilds',
  'BenefitReport',
  'ScreenTimePreFrame',
  'NotificationPreFrame',
  'AccountPrompt',
  'Commitment',
  'ScheduleSession',
  'SocialProof',
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
