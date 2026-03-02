import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useOnboarding } from '../features/onboarding/state/OnboardingProvider';
import { PaywallService } from '../services/PaywallService';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';
import ExpiredPaywallScreen from '../features/paywall/ExpiredPaywallScreen';
import type { RootStackParamList } from '../types/navigation';
import { Colors } from '../design/colors';

const RESTORE_TIMEOUT_MS = 5_000;

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const { state, dispatch, isHydrated } = useOnboarding();

  // null = still checking, true = active, false = expired
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  // Whether we've attempted auto-restore for returning subscribers
  const [restoreAttempted, setRestoreAttempted] = useState(false);

  // Tracks whether onboarding was incomplete when we first rendered.
  // If onboarding completes during this session, the user just purchased
  // through the paywall — so we trust that and skip re-verification
  // (RevenueCat's anonymous ID aliasing makes getCustomerInfo unreliable).
  const wasOnboardingIncomplete = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    if (wasOnboardingIncomplete.current === null) {
      wasOnboardingIncomplete.current = !state.onboardingComplete;
    }
  }, [isHydrated, state.onboardingComplete]);

  // ── Auto-restore: detect returning subscribers on fresh install ──
  useEffect(() => {
    if (!isHydrated || state.onboardingComplete) {
      setRestoreAttempted(true);
      return;
    }

    let cancelled = false;

    async function tryAutoRestore() {
      try {
        const restored = await Promise.race([
          PaywallService.restorePurchases(),
          new Promise<false>((r) => setTimeout(() => r(false), RESTORE_TIMEOUT_MS)),
        ]);

        if (!cancelled && restored) {
          console.log('[RootNavigator] Returning subscriber detected — skipping onboarding');
          setIsPremium(true);
          dispatch({ type: 'COMPLETE_ONBOARDING' });
        }
      } catch {
        // Restore failed — proceed to onboarding
      } finally {
        if (!cancelled) setRestoreAttempted(true);
      }
    }

    tryAutoRestore();
    return () => { cancelled = true; };
  }, [isHydrated, state.onboardingComplete, dispatch]);

  // ── Subscription check after onboarding is complete ──
  // Skip if onboarding just completed this session (user just purchased).
  useEffect(() => {
    if (!isHydrated || !state.onboardingComplete) return;
    if (isPremium !== null) return;

    // Onboarding just finished this session — user purchased through
    // the paywall. Trust that instead of re-checking (aliasing bug).
    if (wasOnboardingIncomplete.current) {
      setIsPremium(true);
      return;
    }

    let cancelled = false;

    async function check() {
      const premium = await PaywallService.isPremium();
      if (!cancelled) setIsPremium(premium);
    }

    check();
    return () => { cancelled = true; };
  }, [isHydrated, state.onboardingComplete, isPremium]);

  // Wait until hydration + restore attempt
  if (!isHydrated || !restoreAttempted) {
    return <View style={styles.loading} />;
  }

  // ── Not yet onboarded → onboarding (paywall is the last screen) ──
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

  // ── Still checking subscription ──
  if (isPremium === null) {
    return <View style={styles.loading} />;
  }

  // ── Subscription inactive → paywall on home screen ──
  if (!isPremium) {
    return (
      <ExpiredPaywallScreen
        onSubscriptionRestored={() => setIsPremium(true)}
      />
    );
  }

  // ── Active subscriber → main app ──
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
