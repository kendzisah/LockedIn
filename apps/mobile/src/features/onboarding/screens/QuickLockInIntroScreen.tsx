import React, { useCallback, useEffect, useRef } from 'react';
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
import { LockModeService } from '../../../services/LockModeService';
import { SessionRepository } from '../../../services/SessionRepository';
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 25;

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'QuickLockInIntro'
>;

const QuickLockInIntroScreen: React.FC<Props> = ({ navigation }) => {
  // ── Screen-level fade ──
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // ── Content stagger ──
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const ruleOpacity = useRef(new Animated.Value(0)).current;
  const ruleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const doctrineOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // ── Button glow pulse ──
  const glowOpacity = useRef(new Animated.Value(0)).current;

  // ── Prefetch onboarding audio while user reads this screen ──
  useEffect(() => {
    SessionRepository.prefetchOnboardingTrack();
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 0ms — Headline slides in
    Animated.parallel([
      Animated.timing(headlineOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(headlineTranslateY, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // 1200ms — "2 minutes. No exits." slides in
    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(ruleOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(ruleTranslateY, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1200),
    );

    // 2200ms — Doctrine line fades in
    timers.push(
      setTimeout(() => {
        Animated.timing(doctrineOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      }, 2200),
    );

    // 3200ms — Button fades in + glow pulse starts
    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();

        // Subtle glow pulse behind button
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowOpacity, {
              toValue: 0.25,
              duration: 1400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.05,
              duration: 1400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ).start();
      }, 3200),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    headlineOpacity,
    headlineTranslateY,
    ruleOpacity,
    ruleTranslateY,
    doctrineOpacity,
    buttonOpacity,
    glowOpacity,
  ]);

  const handleLockIn = useCallback(() => {
    LockModeService.beginSession();
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('QuickLockInSession');
    });
  }, [navigation, screenOpacity]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
    <ScreenContainer>
      <ProgressIndicator current={9} total={11} />

      <View style={styles.body}>
        {/* Headline — commanding, not inviting */}
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: headlineOpacity,
              transform: [{ translateY: headlineTranslateY }],
            },
          ]}
        >
          Your First Lock In{'\n'}Starts Now.
        </Animated.Text>

        {/* Rule — the constraint */}
        <Animated.Text
          style={[
            styles.rule,
            {
              opacity: ruleOpacity,
              transform: [{ translateY: ruleTranslateY }],
            },
          ]}
        >
          2 minutes. No exits.
        </Animated.Text>

        {/* Doctrine — micro psychological anchor */}
        <Animated.Text style={[styles.doctrine, { opacity: doctrineOpacity }]}>
          This is the standard.
        </Animated.Text>
      </View>

      {/* CTA with subtle glow */}
      <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
        <View style={styles.buttonContainer}>
          {/* Glow layer */}
          <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />

          <TouchableOpacity
            onPress={handleLockIn}
            activeOpacity={0.9}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Lock In</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  // ── Headline ──
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 36,
    letterSpacing: -0.8,
    lineHeight: 42,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  // ── Rule line ──
  rule: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  // ── Doctrine — subtle psychological anchor ──
  doctrine: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  // ── CTA ──
  buttonWrap: {
    paddingBottom: 32,
    paddingHorizontal: 4,
  },
  buttonContainer: {
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 6,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    letterSpacing: 0.3,
    color: Colors.textPrimary,
    textTransform: 'uppercase',
  },
});

export default QuickLockInIntroScreen;
