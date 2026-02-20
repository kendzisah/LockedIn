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
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import { Colors } from '../../../design/colors';
import { Typography } from '../../../design/typography';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ConfrontTruth'>;

const SLIDE_DISTANCE = 30;

const ConfrontTruthScreen: React.FC<Props> = ({ navigation }) => {
  const [phase, setPhase] = useState<'intro' | 'transition'>('intro');

  // ── Intro phase animations ──
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;
  const middleOpacity = useRef(new Animated.Value(0)).current;
  const middleTranslateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // ── Transition phase: wraps all intro content for fade-out ──
  const introOpacity = useRef(new Animated.Value(1)).current;

  // ── Transition phase: "Awareness is the first discipline." ──
  const awarenessOpacity = useRef(new Animated.Value(0)).current;
  const awarenessScale = useRef(new Animated.Value(0.92)).current;

  // Intro staggered entrance
  useEffect(() => {
    // Title slides in immediately
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

    // Middle text after 2s
    const middleTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(middleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(middleTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }, 2000);

    // Continue button after 3.5s
    const buttonTimer = setTimeout(() => {
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 3500);

    return () => {
      clearTimeout(middleTimer);
      clearTimeout(buttonTimer);
    };
  }, [titleOpacity, titleTranslateY, middleOpacity, middleTranslateY, buttonOpacity]);

  // Handle Continue press → fade out intro, show awareness, then navigate
  const handleContinue = useCallback(() => {
    if (phase !== 'intro') return;
    setPhase('transition');

    // Fade out all intro content
    Animated.timing(introOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      // Then fade + scale in awareness text
      Animated.parallel([
        Animated.timing(awarenessOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(awarenessScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hold for 1.5s, then fade out awareness before navigating
        setTimeout(() => {
          Animated.timing(awarenessOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start(() => {
            navigation.navigate('SurfacePain');
          });
        }, 1500);
      });
    });
  }, [phase, introOpacity, awarenessOpacity, awarenessScale, navigation]);

  return (
    <ScreenContainer>
      {/* Intro content — fades out on Continue */}
      <Animated.View style={[styles.introWrap, { opacity: introOpacity }]}>
        <ProgressIndicator current={1} total={11} />

        <Animated.Text
          style={[
            styles.title,
            { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] },
          ]}
        >
          You already know{'\n'}what to do.
        </Animated.Text>

        <View style={styles.centerArea}>
          <Animated.Text
            style={[
              styles.highlight,
              { opacity: middleOpacity, transform: [{ translateY: middleTranslateY }] },
            ]}
          >
            But knowing hasn't been the problem.
          </Animated.Text>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.7}
            style={styles.continueButton}
          >
            <Text style={styles.continueText}>Continue →</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* Transition text — centered, fades + scales in after intro fades out */}
      {phase === 'transition' && (
        <Animated.View
          style={[
            styles.awarenessWrap,
            {
              opacity: awarenessOpacity,
              transform: [{ scale: awarenessScale }],
            },
          ]}
        >
          <Text style={styles.awarenessText}>
            Awareness is the first discipline.
          </Text>
        </Animated.View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  introWrap: {
    flex: 1,
  },
  title: {
    ...Typography.hero,
    color: Colors.textPrimary,
    marginTop: 12,
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  highlight: {
    ...Typography.heading,
    color: Colors.primary,
    textAlign: 'center',
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
  awarenessWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  awarenessText: {
    ...Typography.heading,
    color: Colors.accent,
    textAlign: 'center',
  },
});

export default ConfrontTruthScreen;
