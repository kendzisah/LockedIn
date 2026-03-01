import React, { useEffect, useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { ENTITLEMENT_ID } from '../../../services/PaywallService';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PaywallPlaceholder'>;

const PaywallScreen: React.FC<Props> = () => {
  const { dispatch } = useOnboarding();
  const [presenting, setPresenting] = useState(false);

  const presentPaywall = useCallback(async () => {
    if (presenting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPresenting(true);

    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
        displayCloseButton: false,
      });

      if (
        result === PAYWALL_RESULT.PURCHASED ||
        result === PAYWALL_RESULT.RESTORED
      ) {
        // User purchased or restored — complete onboarding
        dispatch({ type: 'COMPLETE_ONBOARDING' });
      } else if (result === PAYWALL_RESULT.NOT_PRESENTED) {
        // User already has the entitlement — skip paywall
        dispatch({ type: 'COMPLETE_ONBOARDING' });
      }
      // CANCELLED or ERROR — stay on this screen
    } catch (err) {
      console.warn('[Paywall] Error presenting paywall:', err);
    } finally {
      setPresenting(false);
    }
  }, [dispatch, presenting]);

  // Auto-present on mount
  useEffect(() => {
    presentPaywall();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container}>
      {presenting ? (
        <ActivityIndicator size="large" color={Colors.accent} />
      ) : (
        <View style={styles.content}>
          <Text style={styles.headline}>Don't Break the{'\n'}System Now.</Text>
          <Text style={styles.subtext}>
            You started the 90-Day Discipline Framework.{'\n'}
            Without full access, your progress stops here.
          </Text>
          <Text style={styles.supportingText}>
            Structure builds identity. Inconsistency erodes it.
          </Text>

          <TouchableOpacity
            style={styles.ctaButton}
            activeOpacity={0.9}
            onPress={presentPaywall}
          >
            <Text style={styles.ctaText}>Unlock Full Access</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  supportingText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    opacity: 0.5,
    textAlign: 'center',
    marginBottom: 36,
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

export default PaywallScreen;
