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
 *
 * @deprecated Replaced by `triggers` (multi-select) in the 26-screen onboarding.
 * Retained for legacy hydration migration only — see OnboardingProvider.
 */
export type VulnerableTime = 'morning' | 'afternoon' | 'evening' | 'late_night';

export type Situation =
  | 'student'
  | 'working'
  | 'figuring'
  | 'building'
  | 'starting_over';

export type Trigger =
  | 'morning'
  | 'late_night'
  | 'around_others'
  | 'bored_alone'
  | 'after_stress'
  | 'during_breaks';

export type MorningRoutine =
  | 'check_phone'
  | 'scroll_notifications'
  | 'snooze'
  | 'get_up';

export type WhyNow =
  | 'tired_wasting'
  | 'failing_goal'
  | 'someone_ahead'
  | 'need_accountability'
  | 'prove_something';

export interface OnboardingState {
  selectedWeaknesses: string[];
  phoneUsageHours: string | null;
  userAge: number | null;
  dailyMinutes: number | null;
  primaryGoal: string | null;
  /** User's self-reported control over daily habits. */
  controlLevel: ControlLevel | null;
  /**
   * @deprecated Replaced by `triggers`. Still hydrated from old persisted state
   * for migration purposes; new flow does not write to this field.
   */
  vulnerableTime: VulnerableTime | null;
  /** Current life stage (screen 5). */
  situation: Situation | null;
  /** Multi-select up to 3 (screen 8). Replaces vulnerableTime. */
  triggers: Trigger[];
  /** First action on waking up (screen 9). */
  morningRoutine: MorningRoutine | null;
  /** Motivation for downloading the app (screen 11). */
  whyNow: WhyNow | null;
  /** First-session reminder time, "HH:MM" 24h (screen 24). */
  scheduledSessionTime: string | null;
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
  | { type: 'SET_SITUATION'; payload: Situation }
  | { type: 'SET_TRIGGERS'; payload: Trigger[] }
  | { type: 'SET_MORNING_ROUTINE'; payload: MorningRoutine }
  | { type: 'SET_WHY_NOW'; payload: WhyNow }
  | { type: 'SET_SCHEDULED_SESSION_TIME'; payload: string }
  | { type: 'SET_SCREEN_TIME_STATUS'; payload: ScreenTimeStatus }
  | { type: 'SET_NOTIFICATIONS_GRANTED'; payload: boolean }
  | { type: 'SET_DEMO_COMPLETED' }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'SET_CURRENT_SCREEN'; payload: string }
  | { type: 'HYDRATE_STATE'; payload: Partial<OnboardingState> }
  | { type: 'FULL_RESET' };
