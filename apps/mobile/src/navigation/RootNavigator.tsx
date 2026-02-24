import React, { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus, View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useOnboarding } from '../features/onboarding/state/OnboardingProvider';
import { PaywallService } from '../services/PaywallService';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';
import ExpiredPaywallScreen from '../features/paywall/ExpiredPaywallScreen';
import type { RootStackParamList } from '../types/navigation';
import { Colors } from '../design/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const { state, isHydrated } = useOnboarding();

  // Subscription gate: null = checking, true = active, false = expired
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  // Check entitlement status
  const checkSubscription = useCallback(async () => {
    const premium = await PaywallService.isPremium();
    setIsPremium(premium);
  }, []);

  // Check on mount (once onboarding state is hydrated and onboarding is complete)
  useEffect(() => {
    if (!isHydrated || !state.onboardingComplete) return;
    checkSubscription();
  }, [isHydrated, state.onboardingComplete, checkSubscription]);

  // Re-check when app comes back to foreground (catches server-side expiry)
  useEffect(() => {
    if (!state.onboardingComplete) return;

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkSubscription();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [state.onboardingComplete, checkSubscription]);

  // Wait until onboarding hydration is complete
  if (!isHydrated) {
    return <View style={styles.loading} />;
  }

  // ── Not yet onboarded → show onboarding flow ──
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

  // ── Onboarded, still checking subscription ──
  if (isPremium === null) {
    return <View style={styles.loading} />;
  }

  // ── Subscription expired → show paywall gate ──
  if (!isPremium) {
    return (
      <ExpiredPaywallScreen
        onSubscriptionRestored={() => setIsPremium(true)}
      />
    );
  }

  // ── Active subscriber → full app ──
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
