/**
 * Onboarding state types.
 */

export type ScreenTimeStatus =
  | 'unavailable'
  | 'not_requested'
  | 'requested'
  | 'granted'
  | 'denied';

export interface OnboardingState {
  selectedWeaknesses: string[];
  phoneUsageHours: string | null;
  userAge: number | null;
  dailyMinutes: number | null;
  primaryGoal: string | null;
  screenTimeStatus: ScreenTimeStatus;
  notificationsGranted: boolean | null;
  demoCompleted: boolean;
  onboardingComplete: boolean;
}

export type OnboardingAction =
  | { type: 'SET_WEAKNESSES'; payload: string[] }
  | { type: 'SET_PHONE_USAGE'; payload: string }
  | { type: 'SET_USER_AGE'; payload: number }
  | { type: 'SET_DAILY_MINUTES'; payload: number }
  | { type: 'SET_PRIMARY_GOAL'; payload: string }
  | { type: 'SET_SCREEN_TIME_STATUS'; payload: ScreenTimeStatus }
  | { type: 'SET_NOTIFICATIONS_GRANTED'; payload: boolean }
  | { type: 'SET_DEMO_COMPLETED' }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'HYDRATE_ONBOARDING'; payload: boolean };
