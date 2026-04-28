/**
 * MorningRoutineQuizScreen — onboarding step 9.
 * "What's the first thing you do when you wake up?" — single select with
 * a brief system-response flash before advancing (NOTED — VULNERABILITY
 * DETECTED / CONSISTENCY DEFICIT / STRONG FOUNDATION).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import type { MorningRoutine } from '../state/types';
import ScreenContainer from '../../../design/components/ScreenContainer';
import HUDOptionCard from '../components/HUDOptionCard';
import HUDSectionLabel from '../components/HUDSectionLabel';
import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'MorningRoutine'>;

const ICON_SIZE = 18;

const OPTIONS: Array<{ value: MorningRoutine; label: string; icon: React.ReactNode }> = [
  {
    value: 'check_phone',
    label: 'Check my phone',
    icon: <Ionicons name="phone-portrait" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'scroll_notifications',
    label: 'Scroll notifications',
    icon: <Ionicons name="notifications" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'snooze',
    label: 'Snooze the alarm',
    icon: <Ionicons name="alarm" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'get_up',
    label: 'Get up and move',
    icon: <MaterialCommunityIcons name="weather-sunset-up" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
];

interface FlashCopy {
  text: string;
  color: string;
}

function getFlash(value: MorningRoutine): FlashCopy {
  switch (value) {
    case 'check_phone':
    case 'scroll_notifications':
      return { text: '// NOTED — MORNING VULNERABILITY DETECTED', color: SystemTokens.red };
    case 'snooze':
      return { text: '// NOTED — CONSISTENCY DEFICIT', color: SystemTokens.gold };
    case 'get_up':
      return { text: '// NOTED — STRONG FOUNDATION', color: SystemTokens.green };
  }
}

const MorningRoutineQuizScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('MorningRoutine');

  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<MorningRoutine | null>(null);
  const [flash, setFlash] = useState<FlashCopy | null>(null);
  const advancingRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const handleSelect = (value: MorningRoutine) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setSelected(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_MORNING_ROUTINE', payload: value });
    Analytics.track('Onboarding Answer Submitted', {
      screen: 'MorningRoutine',
      answer: value,
    });

    const f = getFlash(value);
    setFlash(f);
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(550),
      Animated.timing(flashOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => navigation.navigate('DailyTimeCommitment'));
    });
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <HUDSectionLabel label="DAILY PATTERN" />
          <Text style={styles.title}>
            What's the first thing you do when you wake up?
          </Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => (
              <HUDOptionCard
                key={opt.value}
                label={opt.label}
                leading={opt.icon}
                selected={selected === opt.value}
                onPress={() => handleSelect(opt.value)}
              />
            ))}
          </View>
        </View>

        <Animated.View style={[styles.flashWrap, { opacity: flashOpacity }]} pointerEvents="none">
          {flash ? (
            <Text
              style={[
                styles.flashText,
                {
                  color: flash.color,
                  textShadowColor: flash.color,
                },
              ]}
            >
              {flash.text}
            </Text>
          ) : null}
        </Animated.View>
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
    marginBottom: 24,
  },
  options: {
    gap: 8,
  },
  flashWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: 'center',
  },
  flashText: {
    fontFamily: FontFamily.mono,
    fontSize: 12,
    letterSpacing: 1.4,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});

export default MorningRoutineQuizScreen;
