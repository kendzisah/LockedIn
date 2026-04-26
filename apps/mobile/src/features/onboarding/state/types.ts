/**
 * Onboarding state types.
 */

export type ScreenTimeStatus =
  | 'unavailable'
  | 'not_requested'
  | 'requested'
  | 'granted'
  | 'denied';

export type ControlLevel = 'almost_none' | 'some' | 'decent' | 'strong';

/**
 * Time-of-day window where the user is most vulnerable to distractions.
 * Drives notification timing + mission generation bias.
 */
export type VulnerableTime = 'morning' | 'afternoon' | 'evening' | 'late_night';

export interface OnboardingState {
  selectedWeaknesses: string[];
  phoneUsageHours: string | null;
  userAge: number | null;
  dailyMinutes: number | null;
  primaryGoal: string | null;
  /** User's self-reported control over daily habits (V3 onboarding step 9). */
  controlLevel: ControlLevel | null;
  /** When during the day the system needs to step in (V3 onboarding step 11). */
  vulnerableTime: VulnerableTime | null;
  screenTimeStatus: ScreenTimeStatus;
  notificationsGranted: boolean | null;
  demoCompleted: boolean;
  onboardingComplete: boolean;
  /** ISO timestamp of when onboarding was completed. */
  onboardingCompletedAt: string | null;
  /** Persisted screen name for resume-on-restart */
  currentScreen: string | null;
}

export type OnboardingAction =
  | { type: 'SET_WEAKNESSES'; payload: string[] }
  | { type: 'SET_PHONE_USAGE'; payload: string }
  | { type: 'SET_USER_AGE'; payload: number }
  | { type: 'SET_DAILY_MINUTES'; payload: number }
  | { type: 'SET_PRIMARY_GOAL'; payload: string }
  | { type: 'SET_CONTROL_LEVEL'; payload: ControlLevel }
  | { type: 'SET_VULNERABLE_TIME'; payload: VulnerableTime }
  | { type: 'SET_SCREEN_TIME_STATUS'; payload: ScreenTimeStatus }
  | { type: 'SET_NOTIFICATIONS_GRANTED'; payload: boolean }
  | { type: 'SET_DEMO_COMPLETED' }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'SET_CURRENT_SCREEN'; payload: string }
  | { type: 'HYDRATE_STATE'; payload: Partial<OnboardingState> }
  | { type: 'FULL_RESET' };
