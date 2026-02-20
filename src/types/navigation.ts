import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Onboarding stack screens.
 */
export type OnboardingStackParamList = {
  ConfrontTruth: undefined;
  SurfacePain: undefined;
  PhoneUsageReality: undefined;
  TimeDedication: undefined;
  MechanismIntro: undefined;
  Projection: undefined;
  ScreenTimePermission: undefined;
  NotificationPermission: undefined;
  QuickLockInIntro: undefined;
  QuickLockInSession: undefined;
  QuickLockInComplete: undefined;
  IdentityReinforcement: undefined;
  SignatureCommitment: undefined;
  PaywallPlaceholder: undefined;
};

/**
 * Main app stack screens.
 */
export type MainStackParamList = {
  Home: undefined;
  Session: { duration: number; resuming?: boolean };
};

/**
 * Root stack — single stack with conditional initial route.
 */
export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};
