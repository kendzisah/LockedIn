import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';

const LIFE_EXPECTANCY = 80;
const DEFAULT_AGE = 25;
const WAKING_HOURS = 16;

function parseHoursPerDay(phoneLabel: string): number {
  const match = phoneLabel.match(/^(\d+)\s*hours?$/i);
  if (match) return parseInt(match[1], 10);
  if (phoneLabel === 'unknown') return 4;
  return 3;
}

function calcDaysThisYear(hoursPerDay: number): number {
  return Math.round((hoursPerDay * 365) / 24);
}

function calcYearsLost(hoursPerDay: number, age: number | null): number {
  const currentAge = age ?? DEFAULT_AGE;
  const yearsRemaining = LIFE_EXPECTANCY - currentAge;
  return Math.round(yearsRemaining * (hoursPerDay / WAKING_HOURS));
}

type Props = NativeStackScreenProps<OnboardingStackParamList, 'LossAversionStat'>;

const LossAversionStatScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('LossAversionStat');

  const { state } = useOnboarding();
  const hoursPerDay = parseHoursPerDay(state.phoneUsageHours ?? '');
  const daysThisYear = calcDaysThisYear(hoursPerDay);
  const yearsLost = calcYearsLost(hoursPerDay, state.userAge);

  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Phase 1: intro text
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introTranslateY = useRef(new Animated.Value(14)).current;

  // Phase 2: days count
  const daysOpacity = useRef(new Animated.Value(0)).current;
  const daysCountAnim = useRef(new Animated.Value(0)).current;
  const [displayDays, setDisplayDays] = useState(0);

  // Phase 3: meaning bridge
  const bridgeOpacity = useRef(new Animated.Value(0)).current;

  // Phase 4: years count (hero)
  const yearsOpacity = useRef(new Animated.Value(0)).current;
  const yearsScale = useRef(new Animated.Value(0.85)).current;
  const yearsCountAnim = useRef(new Animated.Value(0)).current;
  const [displayYears, setDisplayYears] = useState(0);

  // Phase 5: closing + disclaimer
  const closingOpacity = useRef(new Animated.Value(0)).current;
  const disclaimerOpacity = useRef(new Animated.Value(0)).current;

  // Button
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 1: intro
    Animated.parallel([
      Animated.timing(introOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(introTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    // Phase 2: days count-up
    const daysListener = daysCountAnim.addListener(({ value }) => setDisplayDays(Math.round(value)));

    timers.push(setTimeout(() => {
      Animated.timing(daysOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      Animated.timing(daysCountAnim, { toValue: daysThisYear, duration: 700, useNativeDriver: false }).start(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      });
    }, 900));

    // Phase 3: bridge text
    timers.push(setTimeout(() => {
      Animated.timing(bridgeOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 2200));

    // Phase 4: years hero count-up
    const yearsListener = yearsCountAnim.addListener(({ value }) => setDisplayYears(Math.round(value)));

    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(yearsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(yearsScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
      Animated.timing(yearsCountAnim, { toValue: yearsLost, duration: 900, useNativeDriver: false }).start(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      });
    }, 3000));

    // Phase 5: closing
    timers.push(setTimeout(() => {
      Animated.timing(closingOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 4200));

    // Disclaimer
    timers.push(setTimeout(() => {
      Animated.timing(disclaimerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 5000));

    // Button
    timers.push(setTimeout(() => {
      Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 5400));

    return () => {
      daysCountAnim.removeListener(daysListener);
      yearsCountAnim.removeListener(yearsListener);
      timers.forEach(clearTimeout);
    };
  }, [
    introOpacity, introTranslateY, daysOpacity, daysCountAnim, daysThisYear,
    bridgeOpacity, yearsOpacity, yearsScale, yearsCountAnim, yearsLost,
    closingOpacity, disclaimerOpacity, buttonOpacity,
  ]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer>

        <View style={styles.body}>
          {/* Intro */}
          <Animated.Text
            style={[
              styles.introText,
              { opacity: introOpacity, transform: [{ translateY: introTranslateY }] },
            ]}
          >
            At your current rate, you'll spend{' '}
            <Animated.Text style={[styles.daysHighlight, { opacity: daysOpacity }]}>
              {displayDays} days
            </Animated.Text>
            {' '}on your phone this year.
          </Animated.Text>

          {/* Bridge */}
          <Animated.Text style={[styles.bridgeText, { opacity: bridgeOpacity }]}>
            Meaning that you're on track to spend
          </Animated.Text>

          {/* Years hero */}
          <Animated.View
            style={[
              styles.yearsRow,
              { opacity: yearsOpacity, transform: [{ scale: yearsScale }] },
            ]}
          >
            <Text style={styles.yearsNumber}>{displayYears} years</Text>
          </Animated.View>

          {/* Closing */}
          <Animated.Text style={[styles.closingText, { opacity: closingOpacity }]}>
            of your life looking down at your phone.{'\n'}{yearsLost} years of <Text style={styles.potentialHighlight}>potential</Text> lost to distraction.
          </Animated.Text>
        </View>

        {/* Disclaimer */}
        <Animated.Text style={[styles.disclaimer, { opacity: disclaimerOpacity }]}>
          Projection of your current Screen Time habits, based on an average {WAKING_HOURS} waking hours each day.
        </Animated.Text>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
                navigation.navigate('Reclaim');
              });
            }}
            activeOpacity={0.85}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  introText: {
    fontFamily: FontFamily.body,
    fontSize: 18,
    lineHeight: 28,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  daysHighlight: {
    fontFamily: FontFamily.headingBold,
    color: Colors.primary,
  },
  bridgeText: {
    fontFamily: FontFamily.body,
    fontSize: 18,
    lineHeight: 28,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  yearsRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  yearsNumber: {
    fontFamily: FontFamily.headingBold,
    fontSize: 56,
    letterSpacing: -1.5,
    lineHeight: 64,
    color: Colors.primary,
    textAlign: 'center',
  },
  closingText: {
    fontFamily: FontFamily.body,
    fontSize: 18,
    lineHeight: 28,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  potentialHighlight: {
    fontFamily: FontFamily.headingBold,
    color: Colors.primary,
  },
  disclaimer: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  buttonWrap: {
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: 0.5,
    color: Colors.textPrimary,
  },
});

export default LossAversionStatScreen;
