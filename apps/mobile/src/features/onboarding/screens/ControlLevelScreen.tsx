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
import type { ControlLevel } from '../state/types';
import ScreenContainer from '../../../design/components/ScreenContainer';
import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 30;

interface Option {
  value: ControlLevel;
  emoji: string;
  label: string;
}

const OPTIONS: Option[] = [
  { value: 'almost_none', emoji: '😤', label: 'Almost none — I react to everything' },
  { value: 'some',        emoji: '😐', label: 'Some — but I slip often' },
  { value: 'decent',      emoji: '🙂', label: 'Decent — I just need structure' },
  { value: 'strong',      emoji: '💪', label: 'Strong — I need the next level' },
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ControlLevel'>;

const ControlLevelScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('ControlLevel');
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
    }, 800));
    return () => timers.forEach(clearTimeout);
  }, [titleOpacity, titleTranslateY, optionsOpacity, optionsTranslateY]);

  const choose = useCallback(
    (option: Option) => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      dispatch({ type: 'SET_CONTROL_LEVEL', payload: option.value });
      Analytics.track('Onboarding Answer Submitted', {
        screen: 'ControlLevel',
        answer: option.value,
      });
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => navigation.navigate('StatReveal'));
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
            <Text style={styles.title}>
              How much control do you have over your daily habits?
            </Text>
            <Text style={styles.subtitle}>
              This sets your starting difficulty.
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
                <Text style={styles.optionText}>{option.label}</Text>
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
    paddingTop: 32,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    letterSpacing: -0.3,
    lineHeight: 30,
    color: Colors.textPrimary,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  options: {
    marginTop: 32,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
});

export default ControlLevelScreen;
