import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useOnboarding } from '../features/onboarding/state/OnboardingProvider';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';
import type { RootStackParamList } from '../types/navigation';
import { Colors } from '../design/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const { state, isHydrated } = useOnboarding();

  // Wait until we know whether onboarding was already completed
  if (!isHydrated) {
    return <View style={styles.loading} />;
  }

  return (
    <Stack.Navigator
      initialRouteName={state.onboardingComplete ? 'Main' : 'Onboarding'}
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      {state.onboardingComplete ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});

export default RootNavigator;
