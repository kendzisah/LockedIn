/**
 * ReclaimScreen — Step 4 in the V3 flow.
 *
 * Follows LossAversionStat. Where that screen showed how much time the
 * user is *losing*, this screen flips the framing and shows what Locked
 * In can give back. Anchors on the 80% reclaim figure with a simple
 * two-bar comparison chart (without vs with the app).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';

const RECLAIM_PCT = 0.8;

function parseHoursPerDay(phoneLabel: string): number {
  const match = phoneLabel.match(/^(\d+)\s*hours?$/i);
  if (match) return parseInt(match[1], 10);
  if (phoneLabel === 'unknown') return 4;
  return 4;
}

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Reclaim'>;

const ReclaimScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('Reclaim');
  const { state } = useOnboarding();

  const hoursWithout = parseHoursPerDay(state.phoneUsageHours ?? '');
  const hoursWith = +(hoursWithout * (1 - RECLAIM_PCT)).toFixed(1);
  const hoursReclaimed = +(hoursWithout * RECLAIM_PCT).toFixed(1);
  // Annualised reclaim in days (out of 24h-day equivalent)
  const annualReclaimDays = Math.round((hoursReclaimed * 365) / 24);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(14)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.85)).current;
  const heroCount = useRef(new Animated.Value(0)).current;
  const [displayHours, setDisplayHours] = useState(0);
  const chartOpacity = useRef(new Animated.Value(0)).current;
  const barWithoutFill = useRef(new Animated.Value(0)).current;
  const barWithFill = useRef(new Animated.Value(0)).current;
  const footnoteOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const advancingRef = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.spring(heroScale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
          Animated.timing(heroCount, {
            toValue: hoursReclaimed,
            duration: 1100,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
        ]).start();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 700),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(chartOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        Animated.timing(barWithoutFill, {
          toValue: 1,
          duration: 900,
          delay: 100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
        Animated.timing(barWithFill, {
          toValue: 1,
          duration: 900,
          delay: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }, 2000),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(footnoteOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }, 3300),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }, 3700),
    );

    const sub = heroCount.addListener(({ value }) => {
      setDisplayHours(Math.round(value * 10) / 10);
    });

    return () => {
      timers.forEach(clearTimeout);
      heroCount.removeListener(sub);
    };
  }, [
    hoursReclaimed,
    headerOpacity,
    headerTranslate,
    heroOpacity,
    heroScale,
    heroCount,
    chartOpacity,
    barWithoutFill,
    barWithFill,
    footnoteOpacity,
    buttonOpacity,
  ]);

  const handleContinue = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => navigation.navigate('AgeQuiz'));
  };

  // Bars share a common max so heights are visually proportional.
  const maxValue = hoursWithout || 1;
  const withoutHeightPct = 100;
  const withHeightPct = (hoursWith / maxValue) * 100;

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <Animated.View
            style={{
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslate }],
            }}
          >
            <Text style={styles.eyebrow}>BUT HERE'S THE FLIP</Text>
            <Text style={styles.title}>You can{'\n'}reclaim 80%.</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.heroBlock,
              {
                opacity: heroOpacity,
                transform: [{ scale: heroScale }],
              },
            ]}
          >
            <Text style={styles.heroValue}>
              {displayHours.toFixed(1)}
              <Text style={styles.heroUnit}> hrs/day</Text>
            </Text>
            <Text style={styles.heroLabel}>back in your hands</Text>
          </Animated.View>

          <Animated.View style={[styles.chart, { opacity: chartOpacity }]}>
            <View style={styles.barCol}>
              <Text style={styles.barValue}>{hoursWithout} hrs</Text>
              <View style={styles.barTrack}>
                <Animated.View
                  style={[
                    styles.barFill,
                    styles.barFillWithout,
                    {
                      height: barWithoutFill.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', `${withoutHeightPct}%`],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>WITHOUT</Text>
              <Text style={styles.barSubLabel}>Locked In</Text>
            </View>

            <View style={styles.barCol}>
              <Text style={[styles.barValue, styles.barValueWith]}>
                {hoursWith} hrs
              </Text>
              <View style={styles.barTrack}>
                <Animated.View
                  style={[
                    styles.barFill,
                    styles.barFillWith,
                    {
                      height: barWithFill.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', `${withHeightPct}%`],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, styles.barLabelWith]}>WITH</Text>
              <Text style={styles.barSubLabel}>Locked In</Text>
            </View>
          </Animated.View>

          <Animated.Text style={[styles.footnote, { opacity: footnoteOpacity }]}>
            That's about <Text style={styles.footnoteAccent}>{annualReclaimDays} extra days</Text> a year — gone into the things that actually move you forward.
          </Animated.Text>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            style={styles.cta}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Show me how</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScreenContainer>
    </Animated.View>
  );
};

const CHART_HEIGHT = 180;

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 8,
  },
  eyebrow: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    letterSpacing: 1.6,
    color: Colors.accent,
  },
  title: {
    marginTop: 6,
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    letterSpacing: -0.4,
    lineHeight: 36,
    color: Colors.textPrimary,
  },
  heroBlock: {
    marginTop: 24,
    alignItems: 'center',
  },
  heroValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 44,
    letterSpacing: -0.5,
    color: Colors.success,
    textShadowColor: 'rgba(0,214,143,0.35)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  heroUnit: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 18,
    color: Colors.success,
  },
  heroLabel: {
    marginTop: 4,
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  chart: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  barCol: {
    width: 100,
    alignItems: 'center',
  },
  barValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
    color: Colors.danger,
    marginBottom: 6,
  },
  barValueWith: {
    color: Colors.success,
  },
  barTrack: {
    width: 56,
    height: CHART_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
  },
  barFillWithout: {
    backgroundColor: Colors.danger,
    shadowColor: Colors.danger,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  barFillWith: {
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  barLabel: {
    marginTop: 10,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.danger,
  },
  barLabelWith: {
    color: Colors.success,
  },
  barSubLabel: {
    marginTop: 1,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  footnote: {
    marginTop: 28,
    paddingHorizontal: 8,
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footnoteAccent: {
    color: Colors.success,
    fontFamily: FontFamily.bodyMedium,
  },
  buttonWrap: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  cta: {
    backgroundColor: 'rgba(58,102,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(120,160,255,0.55)',
    borderRadius: 28,
    paddingVertical: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A66FF',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: -0.1,
    color: Colors.textPrimary,
  },
});

export default ReclaimScreen;
