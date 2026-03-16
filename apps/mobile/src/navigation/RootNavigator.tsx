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

  // ── Loading State ──
  if (!isHydrated) {
    return <View style={styles.loading} />;
  }

  // ── Onboarding Flow ──
  if (!state.onboardingComplete) {
    return (
      <Stack.Navigator
        initialRouteName="Onboarding"
        screenOptions={{ headerShown: false, gestureEnabled: false }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      </Stack.Navigator>
    );
  }

  // ── Main App (subscription gating handled per-action in HomeScreen) ──
  return (
    <Stack.Navigator
      initialRouteName="Main"
      screenOptions={{ headerShown: false, gestureEnabled: false }}
    >
      <Stack.Screen name="Main" component={MainNavigator} />
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
