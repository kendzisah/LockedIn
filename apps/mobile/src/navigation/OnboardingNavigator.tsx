import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../types/navigation';
import { Colors } from '../design/colors';
import { useOnboarding } from '../features/onboarding/state/OnboardingProvider';
import type { OnboardingScreenName } from '../features/onboarding/hooks/useOnboardingTracking';
import { ONBOARDING_SCREEN_ORDER } from '../features/onboarding/hooks/useOnboardingTracking';

import DefinitionScreen from '../features/onboarding/screens/DefinitionScreen';
import PhoneTimeQuizScreen from '../features/onboarding/screens/PhoneTimeQuizScreen';
import { AgeQuizScreen } from '../features/onboarding/screens/AgeQuizScreen';
import LossAversionStatScreen from '../features/onboarding/screens/LossAversionStatScreen';
import GoalQuizScreen from '../features/onboarding/screens/GoalQuizScreen';
import ControlQuizScreen from '../features/onboarding/screens/ControlQuizScreen';
import DailyTimeCommitmentScreen from '../features/onboarding/screens/DailyTimeCommitmentScreen';
import ScreenTimePreFrameScreen from '../features/onboarding/screens/ScreenTimePreFrameScreen';
import NotificationPreFrameScreen from '../features/onboarding/screens/NotificationPreFrameScreen';
import PersonalizedPlanCardScreen from '../features/onboarding/screens/PersonalizedPlanCardScreen';

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
        headerShown: false,
        gestureEnabled: false,
        animation: 'fade',
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="Definition" component={DefinitionScreen} />
      <Stack.Screen name="PhoneTimeQuiz" component={PhoneTimeQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="AgeQuiz" component={AgeQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="LossAversionStat" component={LossAversionStatScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="GoalQuiz" component={GoalQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="ControlQuiz" component={ControlQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="DailyTimeCommitment" component={DailyTimeCommitmentScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="ScreenTimePreFrame" component={ScreenTimePreFrameScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="NotificationPreFrame" component={NotificationPreFrameScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="PersonalizedPlanCard" component={PersonalizedPlanCardScreen} options={{ animation: 'none' }} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
