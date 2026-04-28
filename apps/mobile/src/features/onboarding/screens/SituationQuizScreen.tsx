/**
 * SituationQuizScreen — onboarding step 5.
 * "What's your situation right now?" — captures life stage so missions
 * and copy can adapt to where the user actually is.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import type { Situation } from '../state/types';
import ScreenContainer from '../../../design/components/ScreenContainer';
import HUDOptionCard from '../components/HUDOptionCard';
import HUDSectionLabel from '../components/HUDSectionLabel';
import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Situation'>;

interface Option {
  value: Situation;
  label: string;
  icon: React.ReactNode;
}

const ICON_SIZE = 18;

const OPTIONS: Option[] = [
  {
    value: 'student',
    label: 'Student',
    icon: <Ionicons name="book" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'working',
    label: 'Working',
    icon: <Ionicons name="briefcase" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'figuring',
    label: 'Figuring it out',
    icon: <Ionicons name="search" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'building',
    label: 'Building something',
    icon: <Ionicons name="rocket" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'starting_over',
    label: 'Starting over',
    icon: <MaterialCommunityIcons name="restart" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
];

const SituationQuizScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('Situation');

  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<Situation | null>(null);
  const advancingRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const handleSelect = (value: Situation) => {
    if (advancingRef.current) return;
    setSelected(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_SITUATION', payload: value });
    Analytics.track('Onboarding Answer Submitted', {
      screen: 'Situation',
      answer: value,
    });

    advancingRef.current = true;
    setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => navigation.navigate('GoalQuiz'));
    }, 500);
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <HUDSectionLabel label="CURRENT STATUS" />
          <Text style={styles.title}>What's your situation right now?</Text>
          <Text style={styles.subtitle}>
            The system adapts to where you are — not where you pretend to be.
          </Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => (
              <HUDOptionCard
                key={opt.value}
                label={opt.label}
                leading={opt.icon}
                selected={selected === opt.value}
                onPress={() => handleSelect(opt.value)}
                style={styles.option}
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
    marginBottom: 28,
  },
  options: {
    gap: 8,
  },
  option: {
    marginBottom: 0,
  },
});

export default SituationQuizScreen;
