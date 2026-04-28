import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Onboarding stack screens.
 */
export type OnboardingStackParamList = {
  Definition: undefined;
  PhoneTimeQuiz: undefined;
  WakeUpCall: undefined;
  AgeQuiz: undefined;
  Situation: undefined;
  GoalQuiz: undefined;
  ControlQuiz: undefined;
  Triggers: undefined;
  MorningRoutine: undefined;
  DailyTimeCommitment: undefined;
  WhyNow: undefined;
  ControlLevel: undefined;
  SystemAnalysis: undefined;
  StatReveal: undefined;
  BenefitExecution: undefined;
  BenefitMissions: undefined;
  BenefitRanks: undefined;
  BenefitGuilds: undefined;
  BenefitReport: undefined;
  ScreenTimePreFrame: undefined;
  NotificationPreFrame: undefined;
  AccountPrompt: undefined;
  OnboardingAuth: { mode?: 'signup' | 'signin' } | undefined;
  Commitment: undefined;
  ScheduleSession: undefined;
  SocialProof: undefined;
  Paywall: undefined;
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
  ExecutionBlock: { durationMinutes: number; resumeEndTimestamp?: number };
  SessionComplete: {
    phase: 'execution_block';
    durationMinutes: number;
    streak: number;
  };
  SignUp: undefined;
  SignIn: undefined;
  EditProfile: { source: 'signup' | 'profile' };
  WeeklyReport: undefined;
  GuildDetail: { guild_id: string };
  CreateGuild: undefined;
  JoinGuild: undefined;
};

/**
 * Root stack — single stack with conditional initial route.
 */
export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};
