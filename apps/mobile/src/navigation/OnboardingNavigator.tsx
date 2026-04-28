import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../types/navigation';
import { Colors } from '../design/colors';
import { useOnboarding } from '../features/onboarding/state/OnboardingProvider';
import type { OnboardingScreenName } from '../features/onboarding/hooks/useOnboardingTracking';
import { ONBOARDING_SCREEN_ORDER } from '../features/onboarding/hooks/useOnboardingTracking';
import OnboardingProgressBar from '../features/onboarding/components/OnboardingProgressBar';

import DefinitionScreen from '../features/onboarding/screens/DefinitionScreen';
import PhoneTimeQuizScreen from '../features/onboarding/screens/PhoneTimeQuizScreen';
import WakeUpCallScreen from '../features/onboarding/screens/WakeUpCallScreen';
import { AgeQuizScreen } from '../features/onboarding/screens/AgeQuizScreen';
import SituationQuizScreen from '../features/onboarding/screens/SituationQuizScreen';
import GoalQuizScreen from '../features/onboarding/screens/GoalQuizScreen';
import ControlQuizScreen from '../features/onboarding/screens/ControlQuizScreen';
import TriggersQuizScreen from '../features/onboarding/screens/TriggersQuizScreen';
import MorningRoutineQuizScreen from '../features/onboarding/screens/MorningRoutineQuizScreen';
import DailyTimeCommitmentScreen from '../features/onboarding/screens/DailyTimeCommitmentScreen';
import WhyNowQuizScreen from '../features/onboarding/screens/WhyNowQuizScreen';
import ControlLevelScreen from '../features/onboarding/screens/ControlLevelScreen';
import SystemAnalysisScreen from '../features/onboarding/screens/SystemAnalysisScreen';
import StatRevealScreen from '../features/onboarding/screens/StatRevealScreen';
import BenefitExecutionScreen from '../features/onboarding/screens/BenefitExecutionScreen';
import BenefitMissionsScreen from '../features/onboarding/screens/BenefitMissionsScreen';
import BenefitRanksScreen from '../features/onboarding/screens/BenefitRanksScreen';
import BenefitGuildsScreen from '../features/onboarding/screens/BenefitGuildsScreen';
import BenefitReportScreen from '../features/onboarding/screens/BenefitReportScreen';
import ScreenTimePreFrameScreen from '../features/onboarding/screens/ScreenTimePreFrameScreen';
import NotificationPreFrameScreen from '../features/onboarding/screens/NotificationPreFrameScreen';
import AccountPromptScreen from '../features/onboarding/screens/AccountPromptScreen';
import OnboardingAuthScreen from '../features/onboarding/screens/OnboardingAuthScreen';
import CommitmentScreen from '../features/onboarding/screens/CommitmentScreen';
import ScheduleSessionScreen from '../features/onboarding/screens/ScheduleSessionScreen';
import SocialProofScreen from '../features/onboarding/screens/SocialProofScreen';
import PaywallScreen from '../features/onboarding/screens/PaywallScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * Determine the initial route for the onboarding navigator.
 * If the user previously left mid-onboarding, resume from their last screen.
 * Routes from the legacy 24-step flow that no longer exist will fail the
 * `ONBOARDING_SCREEN_ORDER` check, falling back to Definition.
 */
function getInitialRoute(currentScreen: string | null): keyof OnboardingStackParamList {
  if (
    currentScreen &&
    ONBOARDING_SCREEN_ORDER.includes(currentScreen as OnboardingScreenName)
  ) {
    return currentScreen as keyof OnboardingStackParamList;
  }
  return 'Definition';
}

const OnboardingNavigator: React.FC = () => {
  const { state } = useOnboarding();
  const initialRoute = getInitialRoute(state.currentScreen);

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        // Custom header renders a single persistent progress bar above all
        // screens so it can smoothly tween between steps instead of jumping.
        // The bar collapses to 0 height on routes that opt out (Definition,
        // Commitment, Paywall) so they get full bleed.
        headerShown: true,
        header: () => <OnboardingProgressBar />,
        gestureEnabled: false,
        animation: 'fade',
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="Definition" component={DefinitionScreen} />
      <Stack.Screen name="PhoneTimeQuiz" component={PhoneTimeQuizScreen} />
      <Stack.Screen name="WakeUpCall" component={WakeUpCallScreen} />
      <Stack.Screen name="AgeQuiz" component={AgeQuizScreen} />
      <Stack.Screen name="Situation" component={SituationQuizScreen} />
      <Stack.Screen name="GoalQuiz" component={GoalQuizScreen} />
      <Stack.Screen name="ControlQuiz" component={ControlQuizScreen} />
      <Stack.Screen name="Triggers" component={TriggersQuizScreen} />
      <Stack.Screen name="MorningRoutine" component={MorningRoutineQuizScreen} />
      <Stack.Screen name="DailyTimeCommitment" component={DailyTimeCommitmentScreen} />
      <Stack.Screen name="WhyNow" component={WhyNowQuizScreen} />
      <Stack.Screen name="ControlLevel" component={ControlLevelScreen} />
      <Stack.Screen name="SystemAnalysis" component={SystemAnalysisScreen} />
      <Stack.Screen name="StatReveal" component={StatRevealScreen} />
      <Stack.Screen name="BenefitExecution" component={BenefitExecutionScreen} />
      <Stack.Screen name="BenefitMissions" component={BenefitMissionsScreen} />
      <Stack.Screen name="BenefitRanks" component={BenefitRanksScreen} />
      <Stack.Screen name="BenefitGuilds" component={BenefitGuildsScreen} />
      <Stack.Screen name="BenefitReport" component={BenefitReportScreen} />
      <Stack.Screen name="ScreenTimePreFrame" component={ScreenTimePreFrameScreen} />
      <Stack.Screen name="NotificationPreFrame" component={NotificationPreFrameScreen} />
      <Stack.Screen name="AccountPrompt" component={AccountPromptScreen} />
      <Stack.Screen
        name="OnboardingAuth"
        component={OnboardingAuthScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Commitment" component={CommitmentScreen} />
      <Stack.Screen name="ScheduleSession" component={ScheduleSessionScreen} />
      <Stack.Screen name="SocialProof" component={SocialProofScreen} />
      <Stack.Screen name="Paywall" component={PaywallScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
