/**
 * PhoneTimeQuizScreen — onboarding step 2: "The Problem."
 * Single-select phone-usage band. The chosen value drives the
 * Wake-Up Call calculation on the next screen.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import HUDOptionCard from '../components/HUDOptionCard';
import HUDSectionLabel from '../components/HUDSectionLabel';
import PrimaryButton from '../../../design/components/PrimaryButton';
import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PhoneTimeQuiz'>;

interface Option {
  /** Persisted value — the WakeUpCall screen reads the leading digit. */
  value: string;
  label: string;
  /** Battery fill level shown in the leading icon (0..1). Drains as hours rise. */
  battery: number;
}

const OPTIONS: Option[] = [
  { value: '2 hours', label: '2–3 hours', battery: 0.85 },
  { value: '4 hours', label: '4–5 hours', battery: 0.5  },
  { value: '6 hours', label: '6–7 hours', battery: 0.25 },
  { value: '8 hours', label: '8+ hours',  battery: 0.08 },
];

/**
 * Stylized phone with a battery fill that shrinks as the user picks higher
 * usage bands. Color shifts green → gold → red as the level drops, so the
 * row visually narrates time-loss before the WakeUpCall screen lands.
 */
const PhoneBatteryIcon: React.FC<{ level: number }> = ({ level }) => {
  const W = 14;
  const H = 22;
  const PAD = 2;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2 - 2; // leave a small notch up top
  const clamped = Math.max(0.05, Math.min(1, level));
  const fillH = innerH * clamped;

  const color =
    clamped > 0.6 ? SystemTokens.green :
    clamped > 0.3 ? SystemTokens.gold :
    SystemTokens.red;

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* speaker notch */}
      <Rect x={W / 2 - 2} y={1} width={4} height={1} rx={0.5} ry={0.5} fill={color} opacity={0.6} />
      {/* phone outline */}
      <Rect
        x={0.5}
        y={2.5}
        width={W - 1}
        height={H - 3}
        rx={3}
        ry={3}
        fill="transparent"
        stroke={color}
        strokeWidth={1.2}
      />
      {/* battery fill, anchored to the bottom */}
      <Rect
        x={PAD}
        y={PAD + 2 + (innerH - fillH)}
        width={innerW}
        height={fillH}
        rx={1.5}
        ry={1.5}
        fill={color}
        opacity={0.85}
      />
    </Svg>
  );
};

const PhoneTimeQuizScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('PhoneTimeQuiz');

  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);
  const advancingRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const advanceWith = (value: string) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_PHONE_USAGE', payload: value });
    Analytics.track('Onboarding Answer Submitted', {
      screen: 'PhoneTimeQuiz',
      answer: value,
    });
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => navigation.navigate('WakeUpCall'));
  };

  const handleSelect = (value: string) => {
    if (advancingRef.current) return;
    setSelected(value);
    setTimeout(() => advanceWith(value), 500);
  };

  const handleDontKnow = () => {
    advanceWith('unknown');
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <HUDSectionLabel label="DIAGNOSTICS" />
          <Text style={styles.title}>
            How many hours do you spend on your phone each day?
          </Text>
          <Text style={styles.subtitle}>
            Be honest. The system needs accurate data.
          </Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => (
              <HUDOptionCard
                key={opt.value}
                label={opt.label}
                leading={<PhoneBatteryIcon level={opt.battery} />}
                selected={selected === opt.value}
                onPress={() => handleSelect(opt.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            title="I DON'T KNOW"
            onPress={handleDontKnow}
            secondary
            style={styles.skip}
          />
        </View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 32,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  options: {
    gap: 8,
  },
  footer: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  skip: {
    paddingHorizontal: 0,
  },
});

export default PhoneTimeQuizScreen;
