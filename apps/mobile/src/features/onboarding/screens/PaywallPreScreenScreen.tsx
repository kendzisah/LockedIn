import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import { useSubscription } from '../../subscription/SubscriptionProvider';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { AppsFlyerService } from '../../../services/AppsFlyerService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function computeReclaimedHours(dailyMinutes: string | null): number {
  const map: Record<string, number> = {
    '5 minutes': 7.5,
    '10 minutes': 15,
    '15 minutes': 22,
    '20+ minutes': 30,
  };
  return map[dailyMinutes ?? '15 minutes'] ?? 22;
}

function formatHours(h: number): string {
  if (h >= 1000) return `${Math.round(h / 100) * 100}+`;
  if (h >= 100) return `${Math.round(h)}`;
  if (h % 1 === 0) return `${h}`;
  return h.toFixed(1);
}

const BENEFITS = [
  'Sharper focus under pressure',
  'Fewer hours lost to distraction',
  'Stronger daily discipline habits',
  'Compounding clarity over 90 days',
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PaywallPreScreen'>;

const PaywallPreScreenScreen: React.FC<Props> = ({ navigation }) => {
  const { state, dispatch } = useOnboarding();
  const { showPaywall, isSubscribed } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  const reclaimedBase = computeReclaimedHours(state.dailyMinutes);
  const yearMultiplier = 365 / 90;
  const projections = [
    { period: '90 Days', hours: reclaimedBase },
    { period: '1 Year', hours: Math.round(reclaimedBase * yearMultiplier) },
    { period: '5 Years', hours: Math.round(reclaimedBase * yearMultiplier * 5) },
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
    AppsFlyerService.logEvent('paywall_view', {
      source: 'onboarding',
      goal: state.mainGoal ?? '',
      daily_commitment: state.dailyMinutes ?? '',
    });
  }, [state.mainGoal, state.dailyMinutes]);

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
    await showPaywall();

    if (isSubscribed) {
      Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
        navigation.navigate('SignatureCommitment');
      });
    } else {
      AppsFlyerService.logEvent('paywall_dismiss', {
        source: 'onboarding',
        goal: state.mainGoal ?? '',
        daily_commitment: state.dailyMinutes ?? '',
      });
      setDismissed(true);
    }
  }, [showPaywall, isSubscribed, screenOpacity, navigation, state.mainGoal, state.dailyMinutes]);

  const handleMaybeLater = useCallback(() => {
    AppsFlyerService.logEvent('paywall_dismiss', {
      source: 'onboarding',
      goal: state.mainGoal ?? '',
      daily_commitment: state.dailyMinutes ?? '',
    });
    dispatch({ type: 'COMPLETE_ONBOARDING' });
  }, [dispatch, state.mainGoal, state.dailyMinutes]);

  const fiveYearHours = projections[projections.length - 1].hours;

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <Image
        source={require('../../../../assets/images/staircase-bg.png')}
        style={styles.bgImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={[
          'rgba(14,17,22,0.3)',
          'rgba(14,17,22,0.65)',
          'rgba(14,17,22,0.92)',
          Colors.background,
        ]}
        locations={[0, 0.3, 0.55, 0.75]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <ProgressIndicator current={19} total={19} />

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
              <Text style={styles.statValue}>{formatHours(fiveYearHours)}+</Text>
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
                      {formatHours(p.hours)}h
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

            {dismissed && (
              <TouchableOpacity
                onPress={handleMaybeLater}
                activeOpacity={0.7}
                style={styles.maybeLater}
              >
                <Text style={styles.maybeLaterText}>Maybe later</Text>
              </TouchableOpacity>
            )}
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
  body: { flex: 1, justifyContent: 'flex-end', paddingBottom: 8 },
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
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: Colors.textSecondary,
    width: 44,
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

export default PaywallPreScreenScreen;
