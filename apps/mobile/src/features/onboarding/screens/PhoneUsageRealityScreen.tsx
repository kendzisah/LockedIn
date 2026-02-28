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
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 25;

interface UsageOption {
  label: string;
}

const OPTIONS: UsageOption[] = [
  { label: 'Under 2 hours' },
  { label: '2–4 hours' },
  { label: '4–6 hours' },
  { label: '6+ hours' },
];

/** Personalized reflection copy per selection */
interface Reflection {
  headline: string;
  body: string;
  anchor: string;
}

const REFLECTIONS: Record<string, Reflection> = {
  'Under 2 hours': {
    headline: "You're ahead of most.",
    body: 'Now imagine reclaiming the rest.',
    anchor: 'Small leaks still sink ships.\nPrecision separates average from elite.',
  },
  '2–4 hours': {
    headline: "That's over 1,000 hours a year.",
    body: "That's 25+ full work weeks redirected to distraction.",
    anchor: 'Time compounds. So does discipline.',
  },
  '4–6 hours': {
    headline: "That's nearly 2 months of your year.",
    body: 'Two entire months traded for scrolling.',
    anchor: "Is that aligned with who you're becoming?",
  },
  '6+ hours': {
    headline: "That's a quarter of your waking life.",
    body: "You're not lacking potential. You're leaking it.",
    anchor: "The question isn't ability. It's control.",
  },
};

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'PhoneUsageReality'
>;

const PhoneUsageRealityScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ── Staggered content ──
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // ── Screen-level fade ──
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // ── Reflection page ──
  const reflectionHeadlineOpacity = useRef(new Animated.Value(0)).current;
  const reflectionHeadlineTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const reflectionBodyOpacity = useRef(new Animated.Value(0)).current;
  const reflectionAnchorOpacity = useRef(new Animated.Value(0)).current;
  const reflectionContinueOpacity = useRef(new Animated.Value(0)).current;

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

    // 800ms — Subtext
    timers.push(
      setTimeout(() => {
        Animated.timing(subtextOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 800),
    );

    // 1400ms — Options
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
      }, 1400),
    );

    // 2200ms — Continue button
    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 2200),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    titleOpacity,
    titleTranslateY,
    subtextOpacity,
    optionsOpacity,
    optionsTranslateY,
    buttonOpacity,
  ]);

  const handleSelect = (option: UsageOption) => {
    setSelected(option.label);
    dispatch({ type: 'SET_PHONE_USAGE', payload: option.label });
  };

  const handleContinue = useCallback(() => {
    if (!selected) return;

    setIsTransitioning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Fade out all selection content
    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(subtextOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(optionsOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      // Stagger the reflection content in
      const timers: ReturnType<typeof setTimeout>[] = [];

      // 0ms — Headline
      Animated.parallel([
        Animated.timing(reflectionHeadlineOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(reflectionHeadlineTranslateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // 800ms — Body
      timers.push(
        setTimeout(() => {
          Animated.timing(reflectionBodyOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        }, 800),
      );

      // 1600ms — Anchor
      timers.push(
        setTimeout(() => {
          Animated.timing(reflectionAnchorOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        }, 1600),
      );

      // 2600ms — Continue
      timers.push(
        setTimeout(() => {
          Animated.timing(reflectionContinueOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        }, 2600),
      );

      // Cleanup is not critical here — screen will unmount on navigate
    });
  }, [
    selected,
    titleOpacity,
    subtextOpacity,
    optionsOpacity,
    buttonOpacity,
    reflectionHeadlineOpacity,
    reflectionHeadlineTranslateY,
    reflectionBodyOpacity,
    reflectionAnchorOpacity,
    reflectionContinueOpacity,
  ]);

  const reflection = selected ? REFLECTIONS[selected] : null;

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
    <ScreenContainer centered={false}>
      <ProgressIndicator current={3} total={13} />

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
              How many hours do you{'\n'}waste on your phone{'\n'}each day?
            </Animated.Text>

            {/* Subtext */}
            <Animated.Text style={[styles.subtext, { opacity: subtextOpacity }]}>
              Be honest.
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
            {/* Headline */}
            <Animated.Text
              style={[
                styles.reflectionHeadline,
                {
                  opacity: reflectionHeadlineOpacity,
                  transform: [{ translateY: reflectionHeadlineTranslateY }],
                },
              ]}
            >
              {reflection?.headline}
            </Animated.Text>

            {/* Body */}
            <Animated.Text
              style={[
                styles.reflectionText,
                { opacity: reflectionBodyOpacity },
              ]}
            >
              {reflection?.body}
            </Animated.Text>

            {/* Anchor */}
            <Animated.Text
              style={[
                styles.reflectionAnchor,
                { opacity: reflectionAnchorOpacity },
              ]}
            >
              {reflection?.anchor}
            </Animated.Text>
          </View>

          {/* Continue to next screen */}
          <Animated.View
            style={[styles.buttonWrap, { opacity: reflectionContinueOpacity }]}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Animated.timing(screenOpacity, {
                  toValue: 0,
                  duration: 500,
                  useNativeDriver: true,
                }).start(() => {
                  navigation.navigate('TimeDedication');
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
    marginBottom: 10,
  },
  subtext: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
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
  reflectionHeadline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    letterSpacing: -0.5,
    lineHeight: 34,
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

export default PhoneUsageRealityScreen;
