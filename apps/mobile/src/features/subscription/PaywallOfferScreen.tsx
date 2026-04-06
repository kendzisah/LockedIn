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
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { useOnboarding } from '../onboarding/state/OnboardingProvider';
import { useSubscription } from './SubscriptionProvider';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';
import { Analytics } from '../../services/AnalyticsService';

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

const BENEFITS = [
  'Sharper focus under pressure',
  'Fewer hours lost to distraction',
  'Stronger daily discipline habits',
  'Compounding clarity over 90 days',
];

type Props = NativeStackScreenProps<MainStackParamList, 'PaywallOffer'>;

const PaywallOfferScreen: React.FC<Props> = ({ navigation }) => {
  const { state } = useOnboarding();
  const { showPaywall, isSubscribed } = useSubscription();

  const projections = [
    { period: '90 Days', hours: computeReclaimedHours(state.dailyMinutes, 90) },
    { period: '1 Year', hours: computeReclaimedHours(state.dailyMinutes, 365) },
    { period: '3 Years', hours: computeReclaimedHours(state.dailyMinutes, 365 * 3) },
    { period: '5 Years', hours: computeReclaimedHours(state.dailyMinutes, 365 * 5) },
  ];

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(20)).current;
  const statOpacity = useRef(new Animated.Value(0)).current;
  const statScale = useRef(new Animated.Value(0.9)).current;
  const benefitAnims = useRef(BENEFITS.map(() => new Animated.Value(0))).current;
  const projOpacity = useRef(new Animated.Value(0)).current;
  const projBarAnims = useRef(projections.map(() => new Animated.Value(0))).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Analytics.track('Paywall Shown', { source: 'lock_in' });
    Analytics.trackAF('paywall_view', {
      source: 'home',
      goal: state.primaryGoal ?? '',
      daily_commitment: String(state.dailyMinutes ?? ''),
    });
    Analytics.timeEvent('Paywall Dismissed');
  }, [state.primaryGoal, state.dailyMinutes]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(headlineOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headlineTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(statOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(statScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    }, 500));

    BENEFITS.forEach((_, i) => {
      timers.push(setTimeout(() => {
        Animated.timing(benefitAnims[i], { toValue: 1, duration: 350, useNativeDriver: true }).start();
      }, 900 + i * 100));
    });

    const projStart = 900 + BENEFITS.length * 100 + 200;
    timers.push(setTimeout(() => {
      Animated.timing(projOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      projBarAnims.forEach((anim, i) => {
        setTimeout(() => {
          Animated.spring(anim, { toValue: 1, friction: 10, tension: 50, useNativeDriver: false }).start();
        }, i * 150);
      });
    }, projStart));

    const btnStart = projStart + projections.length * 150 + 300;
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
  }, [headlineOpacity, headlineTranslateY, statOpacity, statScale, benefitAnims, projOpacity, projBarAnims, buttonOpacity, sweepAnim]);

  const handleLockIn = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Analytics.track('Paywall CTA Tapped', { source: 'lock_in' });
    const subscribed = await showPaywall();

    if (subscribed) {
      Analytics.track('Subscription Started', { source: 'lock_in' });
      Analytics.trackAF('af_subscribe', { af_currency: 'USD', af_content_id: 'paywall_lock_in' });
      Animated.timing(screenOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        navigation.goBack();
      });
    } else {
      Analytics.track('Paywall Dismissed', { source: 'lock_in' });
      Analytics.trackAF('paywall_dismiss', {
        source: 'home',
        goal: state.primaryGoal ?? '',
        daily_commitment: String(state.dailyMinutes ?? ''),
      });
      navigation.goBack();
    }
  }, [showPaywall, screenOpacity, navigation, state.primaryGoal, state.dailyMinutes]);

  const handleDismiss = useCallback(() => {
    Analytics.track('Paywall Dismissed', { source: 'lock_in' });
    Analytics.trackAF('paywall_dismiss', {
      source: 'home',
      goal: state.primaryGoal ?? '',
      daily_commitment: String(state.dailyMinutes ?? ''),
    });
    Animated.timing(screenOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      navigation.goBack();
    });
  }, [screenOpacity, navigation, state.primaryGoal, state.dailyMinutes]);

  const fiveYearHours = projections[projections.length - 1].hours;

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <Image
        source={require('../../../assets/images/staircase-bg.png')}
        style={styles.bgImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={[
          'rgba(14,17,22,0.3)',
          'rgba(14,17,22,0.7)',
          'rgba(14,17,22,0.95)',
          Colors.background,
        ]}
        locations={[0, 0.25, 0.45, 0.65]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.body}>
            <Animated.View style={{ opacity: headlineOpacity, transform: [{ translateY: headlineTranslateY }] }}>
              <Text style={styles.headline}>What you stand{'\n'}to gain</Text>
            </Animated.View>

            <Animated.View style={[styles.statCard, { opacity: statOpacity, transform: [{ scale: statScale }] }]}>
              <LinearGradient
                colors={['rgba(0,194,255,0.08)', 'rgba(0,194,255,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.statValue}>{formatHours(fiveYearHours)}</Text>
              <Text style={styles.statLabel}>hours of focus reclaimed over 5 years</Text>
            </Animated.View>

            <View style={styles.benefits}>
              {BENEFITS.map((b, i) => (
                <Animated.View key={b} style={[styles.benefitRow, { opacity: benefitAnims[i] }]}>
                  <Text style={styles.benefitCheck}>✓</Text>
                  <Text style={styles.benefitText}>{b}</Text>
                </Animated.View>
              ))}
            </View>

            <Animated.View style={[styles.projSection, { opacity: projOpacity }]}>
              {projections.map((p, i) => {
                const maxH = projections[projections.length - 1].hours;
                const barWidth = projBarAnims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', `${Math.max((p.hours / maxH) * 100, 12)}%`],
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
              onPress={handleLockIn}
              activeOpacity={0.9}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Lock In</Text>
              <Animated.View
                style={[
                  styles.shineOverlay,
                  {
                    transform: [{
                      translateX: sweepAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-160, SCREEN_WIDTH],
                      }),
                    }],
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
              onPress={handleDismiss}
              activeOpacity={0.7}
              style={styles.maybeLater}
            >
              <Text style={styles.maybeLaterText}>Maybe later</Text>
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
    marginBottom: 16,
  },
  statCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,194,255,0.15)',
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  statValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 48,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  statLabel: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  benefits: { gap: 10, marginBottom: 20 },
  benefitRow: { flexDirection: 'row', alignItems: 'center' },
  benefitCheck: { color: Colors.accent, fontSize: 14, marginRight: 10 },
  benefitText: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    flex: 1,
  },
  projSection: { marginBottom: 4 },
  projRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  projPeriod: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    width: 56,
  },
  projBarTrack: {
    flex: 1,
    height: 18,
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
  },
  buttonWrap: { paddingBottom: 16, paddingHorizontal: 4 },
  ctaButton: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 8,
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
  maybeLater: { alignItems: 'center', paddingVertical: 8 },
  maybeLaterText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.textMuted },
});

export default PaywallOfferScreen;
