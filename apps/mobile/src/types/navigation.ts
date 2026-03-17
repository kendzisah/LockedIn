import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Onboarding stack screens (V2).
 * AwarenessStatement is a phase within SplashHookScreen, not a separate route.
 */
export type OnboardingStackParamList = {
  Definition: undefined;
  SplashHook: undefined;
  PhoneTimeQuiz: undefined;
  AgeQuiz: undefined;
  LossAversionStat: undefined;
  FixPromise: undefined;
  TopPerformersFrame: undefined;
  GoalQuiz: undefined;
  ControlQuiz: undefined;
  DailyTimeCommitment: undefined;
  CompoundStat: undefined;
  NinetyDayVision: undefined;
  ScreenTimePreFrame: undefined;
  ProductExplainer: undefined;
  NotificationPreFrame: undefined;
  PersonalizedPlanCard: undefined;
  EmailCollection: undefined;
  SignatureCommitment: undefined;
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
