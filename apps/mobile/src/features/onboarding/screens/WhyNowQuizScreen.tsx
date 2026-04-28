/**
 * WhyNowQuizScreen — onboarding step 11.
 * "Why now? What made you download this today?" — single select. The
 * selected reason becomes copy for personalized reminder notifications
 * after onboarding.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import type { WhyNow } from '../state/types';
import ScreenContainer from '../../../design/components/ScreenContainer';
import HUDOptionCard from '../components/HUDOptionCard';
import HUDSectionLabel from '../components/HUDSectionLabel';
import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'WhyNow'>;

const ICON_SIZE = 18;

const OPTIONS: Array<{ value: WhyNow; label: string; icon: React.ReactNode }> = [
  {
    value: 'tired_wasting',
    label: "I'm tired of wasting time",
    icon: <Ionicons name="warning" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'failing_goal',
    label: 'I have a goal I keep failing at',
    icon: <MaterialCommunityIcons name="target" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'someone_ahead',
    label: 'Someone I respect is ahead of me',
    icon: <Ionicons name="people" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'need_accountability',
    label: 'I need accountability',
    icon: <Ionicons name="shield" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'prove_something',
    label: 'I want to prove something',
    icon: <Ionicons name="flame" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
];

const WhyNowQuizScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('WhyNow');

  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<WhyNow | null>(null);
  const advancingRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const handleSelect = (value: WhyNow) => {
    if (advancingRef.current) return;
    setSelected(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_WHY_NOW', payload: value });
    Analytics.track('Onboarding Answer Submitted', {
      screen: 'WhyNow',
      answer: value,
    });

    advancingRef.current = true;
    setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => navigation.navigate('ControlLevel'));
    }, 500);
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <HUDSectionLabel label="CORE DRIVE" />
          <Text style={styles.title}>
            Why now? What made you download this today?
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
});

export default WhyNowQuizScreen;
