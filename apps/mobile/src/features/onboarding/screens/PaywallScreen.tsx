import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import { useSubscription } from '../../subscription/SubscriptionProvider';
import { Analytics } from '../../../services/AnalyticsService';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { RankService } from '../../../services/RankService';

const FEATURES: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
  { icon: 'lock-closed-outline',  label: 'Unlimited focus sessions' },
  { icon: 'flash-outline',         label: 'Daily personalized missions' },
  { icon: 'stats-chart-outline',   label: 'Full OVR & stat tracking' },
  { icon: 'trophy-outline',        label: 'Rank progression system' },
  { icon: 'people-outline',        label: 'Guild leaderboards' },
  { icon: 'document-text-outline', label: 'Weekly system reports' },
  { icon: 'shield-outline',        label: 'Streak recovery (1x/week)' },
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Paywall'>;

/** Convert "HH:MM" 24h to "h:MM AM/PM" for display. Falls back to the raw input. */
function formatScheduledTime(value: string): string {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const h24 = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${m} ${ampm}`;
}

const PaywallScreen: React.FC<Props> = () => {
  useOnboardingTracking('Paywall');
  const { state, dispatch } = useOnboarding();
  const { showPaywall, restorePurchases } = useSubscription();

  const screenOpacity = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const advancingRef = useRef(false);
  const startingRank = RankService.rankFromStreak(0);

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    Analytics.track('Paywall Shown', { source: 'onboarding' });

    Animated.loop(
      Animated.sequence([
        Animated.timing(sweepAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(2500),
      ]),
    ).start();
  }, [screenOpacity, sweepAnim]);

  const completeAndExit = useCallback(
    (subscribed: boolean) => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      Analytics.track('Onboarding Completed', {
        screen: 'Paywall',
        subscribed,
        goal: state.primaryGoal ?? '',
        daily_commitment: state.dailyMinutes ?? '',
      });
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        dispatch({ type: 'COMPLETE_ONBOARDING' });
      });
    },
    [dispatch, screenOpacity, state.primaryGoal, state.dailyMinutes],
  );

  const handleSubscribe = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Analytics.track('Paywall CTA Tapped', { source: 'onboarding' });
    try {
      const subscribed = await showPaywall();
      if (subscribed) {
        Analytics.track('Subscription Started', { source: 'onboarding' });
        Analytics.trackAF('af_subscribe', {
          af_currency: 'USD',
          af_content_id: 'onboarding_paywall',
        });
        completeAndExit(true);
      } else {
        Analytics.track('Paywall Dismissed', { source: 'onboarding' });
      }
    } catch (e) {
      console.warn('[PaywallScreen] showPaywall failed:', e);
    }
  }, [showPaywall, completeAndExit]);

  const handleRestore = useCallback(async () => {
    Haptics.selectionAsync();
    Analytics.track('Paywall Restore Tapped', { source: 'onboarding' });
    try {
      const restored = await restorePurchases();
      if (restored) {
        completeAndExit(true);
      }
    } catch (e) {
      console.warn('[PaywallScreen] restorePurchases failed:', e);
    }
  }, [restorePurchases, completeAndExit]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <LinearGradient
        colors={[Colors.background, '#111922', Colors.background]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glow} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.body}>
            <Text style={styles.headline}>UNLOCK THE FULL SYSTEM</Text>
            <Text style={styles.subhead}>
              Your character is created. Your stats are set. Start the game.
            </Text>

            <View style={styles.miniCard}>
              <Text style={[styles.miniRank, { color: startingRank.color }]}>
                OVR 1 • {startingRank.name}
              </Text>
              <Text style={styles.miniSub}>Ready to evolve</Text>
              {state.scheduledSessionTime ? (
                <Text style={styles.miniSchedule}>
                  Session scheduled: {formatScheduledTime(state.scheduledSessionTime)} tomorrow
                </Text>
              ) : null}
            </View>

            <View style={styles.featureList}>
              {FEATURES.map((f) => (
                <View key={f.label} style={styles.featureRow}>
                  <Ionicons name={f.icon} size={16} color={Colors.accent} />
                  <Text style={styles.featureText}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleSubscribe}
              activeOpacity={0.9}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>START MY EVOLUTION</Text>
              <Animated.View
                style={[
                  styles.shineOverlay,
                  {
                    transform: [
                      {
                        translateX: sweepAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-160, 360],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleRestore} activeOpacity={0.7}>
              <Text style={styles.restoreText}>Restore purchases</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                Analytics.track('Paywall Skipped', { source: 'onboarding' });
                completeAndExit(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.laterText}>Maybe later</Text>
            </TouchableOpacity>

            <Text style={styles.finePrint}>
              Cancel anytime. Payment charged after 3-day trial ends on yearly plan.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(58,102,255,0.06)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  body: {
    flex: 1,
    paddingTop: 24,
  },
  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    letterSpacing: -0.3,
    lineHeight: 34,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subhead: {
    marginTop: 8,
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  miniCard: {
    marginTop: 20,
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  miniRank: {
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  miniSub: {
    marginTop: 2,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  miniSchedule: {
    marginTop: 6,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 0.2,
  },
  featureList: {
    marginTop: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  footer: {
    paddingTop: 12,
  },
  cta: {
    backgroundColor: Colors.primary,
    borderRadius: 28,
    paddingVertical: 18,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#3A66FF',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaText: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    letterSpacing: -0.1,
    color: Colors.textPrimary,
  },
  shineOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 160,
  },
  restoreText: {
    marginTop: 14,
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  laterText: {
    marginTop: 10,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    opacity: 0.7,
  },
  finePrint: {
    marginTop: 12,
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});

export default PaywallScreen;
