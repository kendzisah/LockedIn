import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import OptionItem from '../../../design/components/OptionItem';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 25;

interface DedicationOption {
  label: string;
}

const OPTIONS: DedicationOption[] = [
  { label: '5 minutes' },
  { label: '10 minutes' },
  { label: '15 minutes' },
  { label: '20+ minutes' },
];

/** Personalized reflection copy per commitment level */
interface Reflection {
  stat: string;
  body: string;
  anchor: string;
}

const REFLECTIONS: Record<string, Reflection> = {
  '5 minutes': {
    stat: '5 minutes daily = 450 minutes in 90 days.',
    body: 'Consistency beats intensity.\nShow up. Every day.',
    anchor: 'You become what you repeat.',
  },
  '10 minutes': {
    stat: '10 minutes daily = 15 focused hours in 90 days.',
    body: "That's 15 hours redirected toward discipline.",
    anchor: 'Small actions. Compounded identity.',
  },
  '15 minutes': {
    stat: '15 minutes daily = 22+ hours in 90 days.',
    body: 'Over 22 hours invested in your future self.',
    anchor: 'Repetition builds control.',
  },
  '20+ minutes': {
    stat: '20+ minutes daily = 30+ hours in 90 days.',
    body: "That's real conditioning.\nThis is where identity shifts.",
    anchor: 'Discipline is a daily deposit.',
  },
};

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'TimeDedication'
>;

const TimeDedicationScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ── Selection page ──
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // ── Screen-level fade ──
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // ── Reflection page ──
  const refStatOpacity = useRef(new Animated.Value(0)).current;
  const refStatTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const refBodyOpacity = useRef(new Animated.Value(0)).current;
  const refAnchorOpacity = useRef(new Animated.Value(0)).current;
  const refContinueOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 0ms — Title
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // 1000ms — Options
    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(optionsOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(optionsTranslateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1000),
    );

    // 2000ms — Continue button
    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 2000),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    titleOpacity,
    titleTranslateY,
    optionsOpacity,
    optionsTranslateY,
    buttonOpacity,
  ]);

  const handleSelect = (option: DedicationOption) => {
    setSelected(option.label);
    dispatch({ type: 'SET_DAILY_DEDICATION', payload: option.label });
  };

  const handleContinue = useCallback(() => {
    if (!selected) return;

    setIsTransitioning(true);

    // Fade out selection content
    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(optionsOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      // Stagger reflection in

      // 0ms — Stat headline
      Animated.parallel([
        Animated.timing(refStatOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(refStatTranslateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // 800ms — Body
      setTimeout(() => {
        Animated.timing(refBodyOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 800);

      // 1600ms — Anchor
      setTimeout(() => {
        Animated.timing(refAnchorOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 1600);

      // 2600ms — Continue
      setTimeout(() => {
        Animated.timing(refContinueOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 2600);
    });
  }, [
    selected,
    titleOpacity,
    optionsOpacity,
    buttonOpacity,
    refStatOpacity,
    refStatTranslateY,
    refBodyOpacity,
    refAnchorOpacity,
    refContinueOpacity,
  ]);

  const reflection = selected ? REFLECTIONS[selected] : null;

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
    <ScreenContainer centered={false}>
      <ProgressIndicator current={4} total={11} />

      {!isTransitioning ? (
        <>
          <View style={styles.body}>
            {/* Title */}
            <Animated.Text
              style={[
                styles.title,
                {
                  opacity: titleOpacity,
                  transform: [{ translateY: titleTranslateY }],
                },
              ]}
            >
              How much time can you{'\n'}dedicate daily?
            </Animated.Text>

            {/* Options */}
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
                <OptionItem
                  key={option.label}
                  label={option.label}
                  selected={selected === option.label}
                  onPress={() => handleSelect(option)}
                />
              ))}
            </Animated.View>
          </View>

          {/* Continue */}
          <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
            <TouchableOpacity
              onPress={handleContinue}
              activeOpacity={0.7}
              style={styles.continueButton}
              disabled={selected === null}
            >
              <Text
                style={[
                  styles.continueText,
                  selected === null && styles.continueTextDisabled,
                ]}
              >
                Continue →
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      ) : (
        /* ── Reflection page ── */
        <>
          <View style={styles.reflectionBody}>
            {/* Stat headline */}
            <Animated.Text
              style={[
                styles.reflectionStat,
                {
                  opacity: refStatOpacity,
                  transform: [{ translateY: refStatTranslateY }],
                },
              ]}
            >
              {reflection?.stat}
            </Animated.Text>

            {/* Body */}
            <Animated.Text
              style={[styles.reflectionText, { opacity: refBodyOpacity }]}
            >
              {reflection?.body}
            </Animated.Text>

            {/* Anchor */}
            <Animated.Text
              style={[styles.reflectionAnchor, { opacity: refAnchorOpacity }]}
            >
              {reflection?.anchor}
            </Animated.Text>
          </View>

          {/* Continue to next screen */}
          <Animated.View
            style={[styles.buttonWrap, { opacity: refContinueOpacity }]}
          >
            <TouchableOpacity
              onPress={() => {
                Animated.timing(screenOpacity, {
                  toValue: 0,
                  duration: 500,
                  useNativeDriver: true,
                }).start(() => {
                  navigation.navigate('MechanismIntro');
                });
              }}
              activeOpacity={0.7}
              style={styles.continueButton}
            >
              <Text style={styles.continueText}>Continue →</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 48,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 36,
    color: Colors.textPrimary,
    marginBottom: 28,
  },
  options: {
    marginBottom: 16,
  },
  buttonWrap: {
    paddingBottom: 32,
    alignItems: 'flex-end',
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  continueText: {
    fontFamily: FontFamily.bodyMedium,
    color: Colors.textSecondary,
    fontSize: 17,
  },
  continueTextDisabled: {
    color: Colors.textMuted,
  },
  // ── Reflection page ──
  reflectionBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  reflectionStat: {
    fontFamily: FontFamily.headingBold,
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 32,
    color: Colors.primary,
    marginBottom: 14,
  },
  reflectionText: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  reflectionAnchor: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
    opacity: 0.8,
  },
});

export default TimeDedicationScreen;
