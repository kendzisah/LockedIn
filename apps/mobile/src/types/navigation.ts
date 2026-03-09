import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Onboarding stack screens.
 */
export type OnboardingStackParamList = {
  ConfrontTruth: undefined;
  SurfacePain: undefined;
  PhoneUsageReality: undefined;
  TimeDedication: undefined;
  HabitFormation: undefined;
  DisciplineVision: undefined;
  MechanismIntro: undefined;
  Projection: undefined;
  ScreenTimePermission: undefined;
  NotificationPermission: undefined;
  QuickLockInIntro: undefined;
  QuickLockInSession: undefined;
  QuickLockInComplete: undefined;
  IdentityReinforcement: undefined;
  SignatureCommitment: undefined;
};

/**
 * Main app stack screens.
 */
export type MainStackParamList = {
  Home: undefined;
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
