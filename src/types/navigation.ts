import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Onboarding stack screens.
 */
export type OnboardingStackParamList = {
  ConfrontTruth: undefined;
  SurfacePain: undefined;
  MechanismIntro: undefined;
  Projection: undefined;
  ScreenTimePermission: undefined;
  NotificationPermission: undefined;
  QuickLockInIntro: undefined;
  QuickLockInSession: undefined;
  QuickLockInComplete: undefined;
  IdentityReinforcement: undefined;
  PaywallPlaceholder: undefined;
};

/**
 * Main app stack screens.
 */
export type MainStackParamList = {
  Home: undefined;
};

/**
 * Root stack — single stack with conditional initial route.
 */
export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};
