import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useOnboarding } from '../features/onboarding/state/OnboardingProvider';
import { useSubscription } from '../features/subscription/SubscriptionProvider';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';
import PaywallScreen from '../features/subscription/PaywallScreen';
import type { RootStackParamList } from '../types/navigation';
import { Colors } from '../design/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const { state, isHydrated } = useOnboarding();
  const { isSubscribed, isLoading: subLoading } = useSubscription();

  // ── Loading State ──
  if (!isHydrated || subLoading) {
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

  // ── Paywall Gate ──
  if (!isSubscribed) {
    return <PaywallScreen />;
  }

  // ── Main App ──
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
