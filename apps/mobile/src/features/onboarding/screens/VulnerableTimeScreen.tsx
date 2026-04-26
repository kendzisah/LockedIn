/**
 * VulnerableTimeScreen — Step 11.
 *
 * Sits between StatReveal (you've been initialised) and the 5 benefit
 * screens. Frames as "tell the system your weakest window so it can
 * intervene" — gives the user agency before the passive sales pitch.
 *
 * Selection drives later notification timing + mission generation bias.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import type { VulnerableTime } from '../state/types';
import ScreenContainer from '../../../design/components/ScreenContainer';
import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 30;

interface Option {
  value: VulnerableTime;
  emoji: string;
  label: string;
  hint: string;
}

const OPTIONS: Option[] = [
  { value: 'morning',    emoji: '🌅', label: 'Mornings',    hint: 'I struggle to start' },
  { value: 'afternoon',  emoji: '☀️', label: 'Afternoons',  hint: 'I lose focus mid-day' },
  { value: 'evening',    emoji: '🌆', label: 'Evenings',    hint: 'I distract instead of working' },
  { value: 'late_night', emoji: '🌙', label: 'Late night',  hint: 'I scroll when I should sleep' },
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'VulnerableTime'>;

const VulnerableTimeScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('VulnerableTime');
  const { dispatch } = useOnboarding();

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const advancingRef = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(titleTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(optionsOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(optionsTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }, 700));
    return () => timers.forEach(clearTimeout);
  }, [titleOpacity, titleTranslateY, optionsOpacity, optionsTranslateY]);

  const choose = useCallback(
    (option: Option) => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      dispatch({ type: 'SET_VULNERABLE_TIME', payload: option.value });
      Analytics.track('Onboarding Answer Submitted', {
        screen: 'VulnerableTime',
        answer: option.value,
      });
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => navigation.navigate('BenefitExecution'));
    },
    [dispatch, navigation, screenOpacity],
  );

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            }}
          >
            <Text style={styles.eyebrow}>SYSTEM CALIBRATION</Text>
            <Text style={styles.title}>
              When does the system{'\n'}need to step in?
            </Text>
            <Text style={styles.subtitle}>
              The window where you fall off the most. The system will lock you in then.
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.options,
              {
                opacity: optionsOpacity,
                transform: [{ translateY: optionsTranslateY }],
              },
            ]}
          >
            {OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.optionCard}
                onPress={() => choose(option)}
                activeOpacity={0.85}
              >
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionHint}>{option.hint}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 16,
  },
  eyebrow: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    letterSpacing: 1.6,
    color: Colors.accent,
  },
  title: {
    marginTop: 6,
    fontFamily: FontFamily.heading,
    fontSize: 26,
    letterSpacing: -0.3,
    lineHeight: 32,
    color: Colors.textPrimary,
  },
  subtitle: {
    marginTop: 10,
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  options: {
    marginTop: 28,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  optionEmoji: {
    fontSize: 26,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  optionHint: {
    marginTop: 2,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
});

export default VulnerableTimeScreen;
