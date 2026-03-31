import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Onboarding stack screens (V2 — streamlined 10-screen flow).
 *
 * Cut screens: SplashHook, FixPromise, TopPerformersFrame, CompoundStat,
 * NinetyDayVision, ProductExplainer, EmailCollection, SignatureCommitment.
 */
export type OnboardingStackParamList = {
  Definition: undefined;
  PhoneTimeQuiz: undefined;
  AgeQuiz: undefined;
  LossAversionStat: undefined;
  GoalQuiz: undefined;
  ControlQuiz: undefined;
  DailyTimeCommitment: undefined;
  ScreenTimePreFrame: undefined;
  NotificationPreFrame: undefined;
  PersonalizedPlanCard: undefined;
};

/**
 * Main app stack screens.
 */
export type MainStackParamList = {
  Home: undefined;
  PaywallOffer: undefined;
  Session: { phase: 'lock_in' | 'unlock'; programDay: number; resuming?: boolean };
  ExecutionBlock: { durationMinutes: number };
  SessionComplete: {
    phase: 'lock_in' | 'unlock' | 'execution_block';
    durationMinutes: number;
    streak: number;
  };
  ProgramComplete: undefined;
};

/**
 * Root stack — single stack with conditional initial route.
 */
export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};
