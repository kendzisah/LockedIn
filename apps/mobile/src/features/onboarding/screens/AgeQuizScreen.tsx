/**
 * AgeQuizScreen — onboarding step 4: "Your Age."
 * Single-select age band. Drives life-stage copy + retroactive
 * adjustment of the Wake-Up Call calculation.
 *
 * Persisted value is the band midpoint (so downstream code that uses
 * userAge for time-remaining math keeps working without further mapping).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import HUDOptionCard from '../components/HUDOptionCard';
import HUDSectionLabel from '../components/HUDSectionLabel';
import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AgeQuiz'>;

interface Option {
  /** Persisted age value (band midpoint, rounded). */
  value: number;
  label: string;
}

const OPTIONS: Option[] = [
  { value: 14, label: '13–15' },
  { value: 17, label: '16–18' },
  { value: 20, label: '19–21' },
  { value: 23, label: '22–25' },
  { value: 28, label: '25+' },
];

export const AgeQuizScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('AgeQuiz');

  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<number | null>(null);
  const advancingRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const handleSelect = (opt: Option) => {
    if (advancingRef.current) return;
    setSelected(opt.value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_USER_AGE', payload: opt.value });
    Analytics.track('Onboarding Answer Submitted', {
      screen: 'AgeQuiz',
      answer: opt.label,
    });

    advancingRef.current = true;
    setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => navigation.navigate('Situation'));
    }, 500);
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <HUDSectionLabel label="PLAYER PROFILE" />
          <Text style={styles.title}>How old are you?</Text>
          <Text style={styles.subtitle}>
            Your system calibrates to your stage of life.
          </Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => (
              <HUDOptionCard
                key={opt.value}
                label={opt.label}
                selected={selected === opt.value}
                onPress={() => handleSelect(opt)}
              />
            ))}
          </View>
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
});

export default AgeQuizScreen;
