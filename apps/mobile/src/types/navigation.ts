import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Onboarding stack screens.
 */
export type OnboardingStackParamList = {
  Definition: undefined;
  SplashHook: undefined;
  PhoneTimeQuiz: undefined;
  AgeQuiz: undefined;
  LossAversionStat: undefined;
  GoalQuiz: undefined;
  ControlQuiz: undefined;
  FixPromise: undefined;
  TopPerformersFrame: undefined;
  CompoundStat: undefined;
  NinetyDayVision: undefined;
  ProductExplainer: undefined;
  DailyTimeCommitment: undefined;
  EmailCollection: undefined;
  SignatureCommitment: undefined;
  ScreenTimePreFrame: undefined;
  NotificationPreFrame: undefined;
  PersonalizedPlanCard: undefined;
};

/**
 * Bottom tab navigator screens.
 */
export type TabParamList = {
  HomeTab: undefined;
  MissionsTab: undefined;
  LockInTab: undefined;
  BoardTab: undefined;
  ProfileTab: undefined;
};

/**
 * Main app stack screens.
 */
export type MainStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  PaywallOffer: undefined;
  ExecutionBlock: { durationMinutes: number };
  SessionComplete: {
    phase: 'execution_block';
    durationMinutes: number;
    streak: number;
  };
  SignUp: undefined;
  SignIn: undefined;
  WeeklyReport: undefined;
};

/**
 * Root stack — single stack with conditional initial route.
 */
export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};
