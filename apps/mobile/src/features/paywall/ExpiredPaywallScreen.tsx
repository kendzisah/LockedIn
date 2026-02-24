/**
 * ExpiredPaywallScreen — Shown when a returning user's subscription has lapsed.
 *
 * Presents the RevenueCat paywall. On purchase/restore, signals the parent
 * to re-check entitlements and grant access. No close button — the user
 * must resubscribe to continue.
 */

import React, { useEffect, useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { ENTITLEMENT_ID } from '../../services/PaywallService';
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';

interface ExpiredPaywallScreenProps {
  /** Called when the user successfully resubscribes or restores */
  onSubscriptionRestored: () => void;
}

const ExpiredPaywallScreen: React.FC<ExpiredPaywallScreenProps> = ({
  onSubscriptionRestored,
}) => {
  const [presenting, setPresenting] = useState(false);

  const presentPaywall = useCallback(async () => {
    if (presenting) return;
    setPresenting(true);

    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
        displayCloseButton: false,
      });

      if (
        result === PAYWALL_RESULT.PURCHASED ||
        result === PAYWALL_RESULT.RESTORED ||
        result === PAYWALL_RESULT.NOT_PRESENTED
      ) {
        onSubscriptionRestored();
      }
      // CANCELLED / ERROR → stay on this screen
    } catch (err) {
      console.warn('[ExpiredPaywall] Error presenting paywall:', err);
    } finally {
      setPresenting(false);
    }
  }, [presenting, onSubscriptionRestored]);

  // Auto-present on mount
  useEffect(() => {
    presentPaywall();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={styles.container}>
      {presenting ? (
        <ActivityIndicator size="large" color={Colors.accent} />
      ) : (
        <View style={styles.content}>
          <Text style={styles.badge}>SUBSCRIPTION EXPIRED</Text>
          <Text style={styles.headline}>
            Your access{'\n'}has ended.
          </Text>
          <Text style={styles.subtext}>
            Resubscribe to continue your Lock In program{'\n'}
            and pick up where you left off.
          </Text>

          <TouchableOpacity
            style={styles.ctaButton}
            activeOpacity={0.9}
            onPress={presentPaywall}
          >
            <Text style={styles.ctaText}>Resubscribe</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  badge: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.danger,
    letterSpacing: 2,
    marginBottom: 14,
  },
  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    color: Colors.textPrimary,
    letterSpacing: -0.8,
    lineHeight: 38,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtext: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 32,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
});

export default ExpiredPaywallScreen;
