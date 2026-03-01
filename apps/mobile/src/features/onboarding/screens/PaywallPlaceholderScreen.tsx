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
          {/* Progress preview */}
          <View style={styles.progressPreview}>
            <View style={styles.dayRow}>
              <View style={[styles.dayDot, styles.dayDotComplete]} />
              <Text style={[styles.dayLabel, styles.dayLabelComplete]}>Day 1</Text>
              <Text style={styles.dayCheck}>✓</Text>
            </View>
            <View style={styles.dayConnector} />
            <View style={styles.dayRow}>
              <View style={styles.dayDot} />
              <Text style={styles.dayLabel}>Day 2</Text>
              <Text style={styles.dayLock}>🔒</Text>
            </View>
            <View style={styles.dayConnector} />
            <View style={styles.dayRow}>
              <View style={styles.dayDot} />
              <Text style={styles.dayLabel}>Day 3</Text>
              <Text style={styles.dayLock}>🔒</Text>
            </View>
          </View>

          <Text style={styles.headline}>Don't Break the{'\n'}System Now.</Text>
          <Text style={styles.subtext}>
            You started the 90-Day Discipline Framework.{'\n'}
            Without full access, your progress stops here.
          </Text>
          <Text style={styles.supportingText}>
            Structure builds identity. Inconsistency erodes it.
          </Text>

          <View style={styles.divider} />

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
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  progressPreview: {
    alignSelf: 'stretch',
    marginBottom: 40,
    opacity: 0.45,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surface,
  },
  dayDotComplete: {
    backgroundColor: Colors.accent,
  },
  dayLabel: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textMuted,
    flex: 1,
  },
  dayLabelComplete: {
    color: Colors.textSecondary,
  },
  dayCheck: {
    fontSize: 13,
    color: Colors.accent,
  },
  dayLock: {
    fontSize: 12,
  },
  dayConnector: {
    width: 1,
    height: 16,
    backgroundColor: Colors.surface,
    marginLeft: 3.5,
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
    marginBottom: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.surface,
    alignSelf: 'stretch',
    marginVertical: 28,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignSelf: 'stretch',
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
