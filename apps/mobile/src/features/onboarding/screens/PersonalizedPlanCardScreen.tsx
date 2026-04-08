import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import { useSubscription } from '../../subscription/SubscriptionProvider';
import { Analytics } from '../../../services/AnalyticsService';

import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const AF_REG_SENT_KEY = '@lockedin/af_reg_sent';

const CARD_STAGGER = 100;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

function computeReclaimedHours(dailyMinutes: number | null, days: number): number {
  const mins = dailyMinutes ?? 60;
  return Math.round((mins * days) / 60);
}

function formatHours(h: number): string {
  if (h >= 1000) return `${Math.round(h / 100) * 100}h`;
  if (h >= 100) return `${Math.round(h)}h`;
  if (h % 1 === 0) return `${h}h`;
  return `${h.toFixed(1)}h`;
}

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PersonalizedPlanCard'>;

const PersonalizedPlanCardScreen: React.FC<Props> = ({ navigation }) => {
  const { state } = useOnboarding();
  const { showPaywall } = useSubscription();

  useOnboardingTracking('PersonalizedPlanCard');

  useEffect(() => {
    Analytics.track('Paywall Viewed', { source: 'onboarding' });
    Analytics.trackAF('af_content_view', {
      af_content_type: 'paywall',
      af_content_id: 'paywall_onboarding',
      source: 'onboarding',
    });
  }, []);

  /**
   * Fires completion events (Mixpanel + AppsFlyer), then opens the account prompt.
   * Called by BOTH the subscribe path and the "Maybe Later" path.
   */
  const continueToAccountPrompt = useCallback(async (subscribed: boolean) => {
    // Fire Onboarding Completed (previously only fired on SignatureCommitment)
    Analytics.track('Onboarding Completed', {
      screen: 'PersonalizedPlanCard',
      subscribed,
      goal: state.primaryGoal ?? '',
      daily_commitment: state.dailyMinutes ?? '',
    });

    // Fire AppsFlyer registration event (deduplicated)
    try {
      const sent = await AsyncStorage.getItem(AF_REG_SENT_KEY);
      if (!sent) {
        Analytics.trackAF('af_complete_registration', {
          af_registration_method: subscribed ? 'paywall_subscribe' : 'paywall_skip',
        });
        await AsyncStorage.setItem(AF_REG_SENT_KEY, '1');
      }
    } catch {}

    navigation.navigate('AccountPrompt');
  }, [navigation, state.primaryGoal, state.dailyMinutes]);

  const dailyHours = (state.dailyMinutes ?? 60) / 60;
  const dailyLabel = dailyHours === 1 ? '1 hour' : `${dailyHours} hours`;

  const rows = [
    { label: 'Goal', value: state.primaryGoal ?? 'Build discipline', icon: '◎' },
    { label: 'Daily Lock In', value: dailyLabel, icon: '◉' },
    { label: 'Focus Area', value: state.selectedWeaknesses[0] ?? 'Consistency', icon: '◈' },
  ];

  const projections = [
    { period: '90 Days', hours: computeReclaimedHours(state.dailyMinutes, 90) },
    { period: '1 Year', hours: computeReclaimedHours(state.dailyMinutes, 365) },
    { period: '3 Years', hours: computeReclaimedHours(state.dailyMinutes, 365 * 3) },
    { period: '5 Years', hours: computeReclaimedHours(state.dailyMinutes, 365 * 5) },
  ];

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(20)).current;
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const rowAnims = useRef(rows.map(() => ({
    opacity: new Animated.Value(0),
    translateX: new Animated.Value(-12),
  }))).current;
  const projectionOpacity = useRef(new Animated.Value(0)).current;
  const projBarAnims = useRef(projections.map(() => new Animated.Value(0))).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(headlineOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headlineTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    timers.push(setTimeout(() => {
      Animated.timing(subtextOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 400));

    rows.forEach((_, i) => {
      timers.push(setTimeout(() => {
        Animated.parallel([
          Animated.timing(rowAnims[i].opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(rowAnims[i].translateX, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]).start();
      }, 700 + i * CARD_STAGGER));
    });

    const projStart = 700 + rows.length * CARD_STAGGER + 200;
    timers.push(setTimeout(() => {
      Animated.timing(projectionOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      projBarAnims.forEach((anim, i) => {
        setTimeout(() => {
          Animated.spring(anim, { toValue: 1, friction: 10, tension: 50, useNativeDriver: false }).start();
          if (i === projBarAnims.length - 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }, i * 150);
      });
    }, projStart));

    const btnStart = projStart + projections.length * 150 + 400;
    timers.push(setTimeout(() => {
      Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
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
    }, btnStart));

    return () => timers.forEach(clearTimeout);
  }, [headlineOpacity, headlineTranslateY, subtextOpacity, rowAnims, projectionOpacity, projBarAnims, buttonOpacity, sweepAnim]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <Image
        source={require('../../../../assets/images/mountain-bg.png')}
        style={styles.bgImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={[
          'rgba(14,17,22,0.55)',
          'rgba(14,17,22,0.80)',
          'rgba(14,17,22,0.95)',
          Colors.background,
        ]}
        locations={[0, 0.35, 0.6, 0.85]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
        <ProgressIndicator current={10} total={10} />

        <View style={styles.body}>
          <Animated.View style={{ opacity: headlineOpacity, transform: [{ translateY: headlineTranslateY }] }}>
            <Text style={styles.headline}>
              Your 90-Day{'\n'}Discipline Protocol
            </Text>
          </Animated.View>

          <Animated.Text style={[styles.subtext, { opacity: subtextOpacity }]}>
            Designed around your goals
          </Animated.Text>

          <View style={styles.rowsContainer}>
            {rows.map((row, i) => (
              <Animated.View
                key={row.label}
                style={[
                  styles.row,
                  { opacity: rowAnims[i].opacity, transform: [{ translateX: rowAnims[i].translateX }] },
                ]}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.rowIcon}>{row.icon}</Text>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                </View>
                <Text style={styles.rowValue} numberOfLines={1}>{row.value}</Text>
              </Animated.View>
            ))}
          </View>

          <Animated.View style={[styles.projectionSection, { opacity: projectionOpacity }]}>
            <Text style={styles.projectionTitle}>Focus Hours You'll Reclaim</Text>
            {projections.map((p, i) => {
              const maxHours = projections[projections.length - 1].hours;
              const barWidth = projBarAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', `${Math.max((p.hours / maxHours) * 100, 12)}%`],
              });
              const isLast = i === projections.length - 1;
              return (
                <View key={p.period} style={styles.projRow}>
                  <Text style={styles.projPeriod}>{p.period}</Text>
                  <View style={styles.projBarTrack}>
                    <Animated.View style={[styles.projBarFill, isLast && styles.projBarFillAccent, { width: barWidth }]}>
                      {isLast && (
                        <LinearGradient
                          colors={['rgba(0,194,255,0.4)', 'rgba(0,194,255,0.15)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                    </Animated.View>
                  </View>
                  <Text style={[styles.projHours, isLast && styles.projHoursAccent]}>
                    {formatHours(p.hours)}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Analytics.track('Paywall CTA Tapped', { source: 'onboarding' });
              const subscribed = await showPaywall();
              if (subscribed) {
                Analytics.track('Subscription Started', { source: 'onboarding' });
                Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
                  continueToAccountPrompt(true);
                });
              } else {
                Analytics.track('Paywall Dismissed', { source: 'onboarding' });
              }
            }}
            activeOpacity={0.9}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Lock In</Text>

            <Animated.View
              style={[
                styles.shineOverlay,
                {
                  transform: [
                    {
                      translateX: sweepAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-160, SCREEN_WIDTH],
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

          <TouchableOpacity
            onPress={() => {
              Analytics.track('Paywall Skipped', { source: 'onboarding' });
              continueToAccountPrompt(false);
            }}
            activeOpacity={0.7}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Maybe Later</Text>
          </TouchableOpacity>
        </Animated.View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, paddingHorizontal: 24, paddingVertical: 16 },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  body: { flex: 1, justifyContent: 'center' },
  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 36,
    color: Colors.accent,
    marginBottom: 8,
  },
  subtext: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textMuted,
    marginBottom: 24,
  },

  rowsContainer: { marginBottom: 28 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    fontSize: 12,
    color: Colors.accent,
    marginRight: 8,
  },
  rowLabel: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowValue: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '55%',
  },

  projectionSection: { marginBottom: 8 },
  projectionTitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.accent,
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  projectionSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 14,
    opacity: 0.6,
  },
  projRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  projPeriod: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    width: 62,
  },
  projBarTrack: {
    flex: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  projBarFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  projBarFillAccent: {
    backgroundColor: 'transparent',
  },
  projHours: {
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
    color: Colors.textSecondary,
    width: 54,
    textAlign: 'right',
  },
  projHoursAccent: {
    color: Colors.accent,
    fontSize: 17,
  },

  buttonWrap: { paddingBottom: 32, paddingHorizontal: 4 },
  ctaButton: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.55)',
  },
  shineOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 120,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  skipText: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
  },
});

export default PersonalizedPlanCardScreen;
