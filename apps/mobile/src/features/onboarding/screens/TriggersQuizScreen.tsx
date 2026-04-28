/**
 * TriggersQuizScreen — onboarding step 8.
 * "When do you lose focus?" — multi-select up to 3. Replaces the old
 * single-value VulnerableTime screen.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import type { Trigger } from '../state/types';
import ScreenContainer from '../../../design/components/ScreenContainer';
import HUDOptionCard from '../components/HUDOptionCard';
import HUDSectionLabel from '../components/HUDSectionLabel';
import PrimaryButton from '../../../design/components/PrimaryButton';
import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Triggers'>;

const MAX_SELECT = 3;
const ICON_SIZE = 18;

const OPTIONS: Array<{ value: Trigger; label: string; iconName: keyof typeof Ionicons.glyphMap }> = [
  { value: 'morning',       label: 'First thing in the morning', iconName: 'sunny' },
  { value: 'late_night',    label: 'Late at night',              iconName: 'moon' },
  { value: 'around_others', label: "When I'm around others",     iconName: 'people' },
  { value: 'bored_alone',   label: "When I'm bored or alone",    iconName: 'cloud' },
  { value: 'after_stress',  label: 'After stressful moments',    iconName: 'flash' },
  { value: 'during_breaks', label: 'During breaks',              iconName: 'cafe' },
];

const TriggersQuizScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('Triggers');

  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<Trigger[]>([]);
  const advancingRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const handleToggle = (value: Trigger) => {
    if (advancingRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      if (prev.includes(value)) {
        return prev.filter((v) => v !== value);
      }
      // At cap: drop the oldest selection and append the new one.
      if (prev.length >= MAX_SELECT) {
        return [...prev.slice(1), value];
      }
      return [...prev, value];
    });
  };

  const handleContinue = () => {
    if (advancingRef.current || selected.length === 0) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dispatch({ type: 'SET_TRIGGERS', payload: selected });
    Analytics.track('Onboarding Answer Submitted', {
      screen: 'Triggers',
      answer: selected.join(', '),
    });
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => navigation.navigate('MorningRoutine'));
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <HUDSectionLabel label="THREAT ANALYSIS" />
          <Text style={styles.title}>When do you lose focus?</Text>
          <Text style={styles.subtitle}>
            Select up to 3. The system learns your patterns.
          </Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => (
              <HUDOptionCard
                key={opt.value}
                label={opt.label}
                leading={
                  <Ionicons
                    name={opt.iconName}
                    size={ICON_SIZE}
                    color={SystemTokens.glowAccent}
                  />
                }
                selected={selected.includes(opt.value)}
                onPress={() => handleToggle(opt.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            title={selected.length === 0 ? 'SELECT AT LEAST ONE' : '> CONTINUE'}
            onPress={handleContinue}
            disabled={selected.length === 0}
            style={styles.cta}
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
  },
  cta: {
    width: '100%',
  },
});

export default TriggersQuizScreen;
