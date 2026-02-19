import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useOnboarding } from '../features/onboarding/state/OnboardingProvider';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const { state } = useOnboarding();

  return (
    <Stack.Navigator
      initialRouteName={state.onboardingComplete ? 'Main' : 'Onboarding'}
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      <Stack.Screen name="Main" component={MainNavigator} />
    </Stack.Navigator>
  );
};

export default RootNavigator;
