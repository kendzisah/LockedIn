/**
 * PaywallScreen — Hard-gate paywall shown after onboarding.
 *
 * Presents the RevenueCat paywall on mount. If the user dismisses without
 * subscribing, re-presents after a brief delay. Includes a "Restore Purchases"
 * option for users who reinstalled the app.
 *
 * Transitions away automatically when SubscriptionProvider detects an active
 * entitlement (RootNavigator swaps to MainNavigator).
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from './SubscriptionProvider';
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';

const PaywallScreen: React.FC = () => {
  const { showPaywall, restorePurchases, isSubscribed } = useSubscription();
  const presenting = useRef(false);

  const present = useCallback(async () => {
    if (presenting.current || isSubscribed) return;
    presenting.current = true;
    await showPaywall();
    presenting.current = false;
  }, [showPaywall, isSubscribed]);

  useEffect(() => {
    present();
  }, [present]);

  const handleRestore = useCallback(async () => {
    const restored = await restorePurchases();
    if (!restored) {
      present();
    }
  }, [restorePurchases, present]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Text style={styles.title}>Unlock LockedIn</Text>
          <Text style={styles.subtitle}>
            Subscribe to start your 90-day discipline journey.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={present}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryText}>View Plans</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            activeOpacity={0.7}
          >
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safe: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    paddingHorizontal: 48,
    borderRadius: 6,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  primaryText: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreText: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textMuted,
  },
});

export default PaywallScreen;
