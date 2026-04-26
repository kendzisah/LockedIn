import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../types/navigation';
import { Colors } from '../design/colors';
import { useOnboarding } from '../features/onboarding/state/OnboardingProvider';
import type { OnboardingScreenName } from '../features/onboarding/hooks/useOnboardingTracking';
import { ONBOARDING_SCREEN_ORDER } from '../features/onboarding/hooks/useOnboardingTracking';
import OnboardingProgressBar from '../features/onboarding/components/OnboardingProgressBar';

import DefinitionScreen from '../features/onboarding/screens/DefinitionScreen';
import PhoneTimeQuizScreen from '../features/onboarding/screens/PhoneTimeQuizScreen';
import LossAversionStatScreen from '../features/onboarding/screens/LossAversionStatScreen';
import ReclaimScreen from '../features/onboarding/screens/ReclaimScreen';
import { AgeQuizScreen } from '../features/onboarding/screens/AgeQuizScreen';
import GoalQuizScreen from '../features/onboarding/screens/GoalQuizScreen';
import ControlQuizScreen from '../features/onboarding/screens/ControlQuizScreen';
import DailyTimeCommitmentScreen from '../features/onboarding/screens/DailyTimeCommitmentScreen';
import ControlLevelScreen from '../features/onboarding/screens/ControlLevelScreen';
import StatRevealScreen from '../features/onboarding/screens/StatRevealScreen';
import Day90PreviewScreen from '../features/onboarding/screens/Day90PreviewScreen';
import VulnerableTimeScreen from '../features/onboarding/screens/VulnerableTimeScreen';
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
import SocialProofScreen from '../features/onboarding/screens/SocialProofScreen';
import TrialPreviewScreen from '../features/onboarding/screens/TrialPreviewScreen';
import PaywallScreen from '../features/onboarding/screens/PaywallScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * Determine the initial route for the onboarding navigator.
 * If the user previously left mid-onboarding, resume from their last screen.
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
      <Stack.Screen name="PhoneTimeQuiz" component={PhoneTimeQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="LossAversionStat" component={LossAversionStatScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="Reclaim" component={ReclaimScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="AgeQuiz" component={AgeQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="GoalQuiz" component={GoalQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="ControlQuiz" component={ControlQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="DailyTimeCommitment" component={DailyTimeCommitmentScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="ControlLevel" component={ControlLevelScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="StatReveal" component={StatRevealScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Day90Preview" component={Day90PreviewScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="VulnerableTime" component={VulnerableTimeScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="BenefitExecution" component={BenefitExecutionScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="BenefitMissions" component={BenefitMissionsScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="BenefitRanks" component={BenefitRanksScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="BenefitGuilds" component={BenefitGuildsScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="BenefitReport" component={BenefitReportScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="ScreenTimePreFrame" component={ScreenTimePreFrameScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="NotificationPreFrame" component={NotificationPreFrameScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="AccountPrompt" component={AccountPromptScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="OnboardingAuth" component={OnboardingAuthScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Commitment" component={CommitmentScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="SocialProof" component={SocialProofScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="TrialPreview" component={TrialPreviewScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Paywall" component={PaywallScreen} options={{ animation: 'fade' }} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
