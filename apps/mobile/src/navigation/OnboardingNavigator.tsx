import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../types/navigation';
import { Colors } from '../design/colors';

import SplashHookScreen from '../features/onboarding/screens/SplashHookScreen';
import PhoneTimeQuizScreen from '../features/onboarding/screens/PhoneTimeQuizScreen';
import { AgeQuizScreen } from '../features/onboarding/screens/AgeQuizScreen';
import LossAversionStatScreen from '../features/onboarding/screens/LossAversionStatScreen';
import TopPerformersFrameScreen from '../features/onboarding/screens/TopPerformersFrameScreen';
import GoalQuizScreen from '../features/onboarding/screens/GoalQuizScreen';
import ControlQuizScreen from '../features/onboarding/screens/ControlQuizScreen';
import DailyTimeCommitmentScreen from '../features/onboarding/screens/DailyTimeCommitmentScreen';
import CompoundStatScreen from '../features/onboarding/screens/CompoundStatScreen';
import NinetyDayVisionScreen from '../features/onboarding/screens/NinetyDayVisionScreen';
import ScreenTimePreFrameScreen from '../features/onboarding/screens/ScreenTimePreFrameScreen';
import ProductExplainerScreen from '../features/onboarding/screens/ProductExplainerScreen';
import EnforceMyFocusScreen from '../features/onboarding/screens/EnforceMyFocusScreen';
import LiveSessionScreen from '../features/onboarding/screens/LiveSessionScreen';
import PostSessionAffirmationScreen from '../features/onboarding/screens/PostSessionAffirmationScreen';
import NotificationPreFrameScreen from '../features/onboarding/screens/NotificationPreFrameScreen';
import PersonalizedPlanCardScreen from '../features/onboarding/screens/PersonalizedPlanCardScreen';
import PaywallPreScreenScreen from '../features/onboarding/screens/PaywallPreScreenScreen';
import SignatureCommitmentScreen from '../features/onboarding/screens/SignatureCommitmentScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="SplashHook"
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animation: 'fade',
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="SplashHook" component={SplashHookScreen} />
      <Stack.Screen name="PhoneTimeQuiz" component={PhoneTimeQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="AgeQuiz" component={AgeQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="LossAversionStat" component={LossAversionStatScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="TopPerformersFrame" component={TopPerformersFrameScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="GoalQuiz" component={GoalQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="ControlQuiz" component={ControlQuizScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="DailyTimeCommitment" component={DailyTimeCommitmentScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="CompoundStat" component={CompoundStatScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="NinetyDayVision" component={NinetyDayVisionScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="ScreenTimePreFrame" component={ScreenTimePreFrameScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="ProductExplainer" component={ProductExplainerScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="EnforceMyFocus" component={EnforceMyFocusScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="LiveSession" component={LiveSessionScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="PostSessionAffirmation" component={PostSessionAffirmationScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="NotificationPreFrame" component={NotificationPreFrameScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="PersonalizedPlanCard" component={PersonalizedPlanCardScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="PaywallPreScreen" component={PaywallPreScreenScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="SignatureCommitment" component={SignatureCommitmentScreen} options={{ animation: 'none' }} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
