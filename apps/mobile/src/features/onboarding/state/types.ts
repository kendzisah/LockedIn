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
  selectedPainPoint: string | null;
  phoneUsageHours: string | null;
  dailyDedication: string | null;
  selectedGoals: string[];
  screenTimeStatus: ScreenTimeStatus;
  notificationsGranted: boolean | null; // null = not yet asked
  demoCompleted: boolean;
  onboardingComplete: boolean;
}

export type OnboardingAction =
  | { type: 'SET_PAIN_POINT'; payload: string }
  | { type: 'SET_PHONE_USAGE'; payload: string }
  | { type: 'SET_DAILY_DEDICATION'; payload: string }
  | { type: 'SET_GOALS'; payload: string[] }
  | { type: 'SET_SCREEN_TIME_STATUS'; payload: ScreenTimeStatus }
  | { type: 'SET_NOTIFICATIONS_GRANTED'; payload: boolean }
  | { type: 'SET_DEMO_COMPLETED' }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'HYDRATE_ONBOARDING'; payload: boolean };
