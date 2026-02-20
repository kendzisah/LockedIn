import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import { Typography } from '../../../design/typography';

const PAIN_POINTS = [
  'I scroll when I should execute',
  'I start strong, then fall off',
  'I get emotionally reactive',
  'I relapse into distractions',
  'I lack daily consistency',
];

const SLIDE_DISTANCE = 30;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SurfacePain'>;

const SurfacePainScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);

  // ── Screen-level fade ──
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // ── Animations ──
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Step 1: Title slides in immediately
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

    // Step 2: Options slide in after 1s
    const optionsTimer = setTimeout(() => {
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
    }, 1000);

    // Step 3: Continue button fades in after 2s
    const buttonTimer = setTimeout(() => {
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 2000);

    return () => {
      clearTimeout(optionsTimer);
      clearTimeout(buttonTimer);
    };
  }, [titleOpacity, titleTranslateY, optionsOpacity, optionsTranslateY, buttonOpacity]);

  // Microcopy animation — triggers once on first selection
  const microcopyOpacity = useRef(new Animated.Value(0)).current;
  const microcopyTranslateY = useRef(new Animated.Value(12)).current;
  const hasAnimatedMicrocopy = useRef(false);

  const handleSelect = (point: string) => {
    setSelected(point);
    dispatch({ type: 'SET_PAIN_POINT', payload: point });

    if (!hasAnimatedMicrocopy.current) {
      hasAnimatedMicrocopy.current = true;
      Animated.parallel([
        Animated.timing(microcopyOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(microcopyTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleContinue = useCallback(() => {
    if (!selected) return;
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('PhoneUsageReality');
    });
  }, [selected, screenOpacity, navigation]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
    <ScreenContainer centered={false}>
      <ProgressIndicator current={2} total={11} />

      <View style={styles.body}>
        {/* Title — slides in first */}
        <Animated.Text
          style={[
            styles.title,
            { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] },
          ]}
        >
          Where are you losing control?
        </Animated.Text>

        {/* Options — slide in after 1s */}
        <Animated.View
          style={[
            styles.options,
            { opacity: optionsOpacity, transform: [{ translateY: optionsTranslateY }] },
          ]}
        >
          {PAIN_POINTS.map((point) => (
            <OptionItem
              key={point}
              label={point}
              selected={selected === point}
              onPress={() => handleSelect(point)}
            />
          ))}
        </Animated.View>

        {/* Microcopy removed — shown on previous screen */}
      </View>

      {/* Continue → minimal link, bottom-right */}
      <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.7}
          disabled={selected === null}
          style={styles.continueButton}
        >
          <Text
            style={[
              styles.continueText,
              selected === null && styles.continueDisabled,
            ]}
          >
            Continue →
          </Text>
        </TouchableOpacity>
      </Animated.View>
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
    ...Typography.heading,
    color: Colors.textPrimary,
    marginBottom: 24,
  },
  options: {
    marginBottom: 16,
  },
  microcopy: {
    ...Typography.subtext,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 8,
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
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontSize: 17,
  },
  continueDisabled: {
    color: Colors.textMuted,
  },
});

export default SurfacePainScreen;
