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
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const BULLETS = [
  'Your phone goes silent',
  'Distractions are blocked',
  'You complete a structured session',
  'You train self-command under pressure',
];

const SLIDE = 20;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'MechanismIntro'>;

const MechanismIntroScreen: React.FC<Props> = ({ navigation }) => {
  // ── Screen-level fade ──
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Lock icon — fade in + subtle pulse
  const lockOpacity = useRef(new Animated.Value(0)).current;
  const lockPulse = useRef(new Animated.Value(1)).current;

  // Header
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(SLIDE)).current;

  // Subtext
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const subtextTranslateY = useRef(new Animated.Value(SLIDE)).current;

  // Bullets
  const bulletAnims = useRef(
    BULLETS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(SLIDE),
    })),
  ).current;

  // CTA
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 0ms — Lock icon fades in
    Animated.timing(lockOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Subtle pulse — barely perceptible, mechanical not meditative
    Animated.loop(
      Animated.sequence([
        Animated.timing(lockPulse, {
          toValue: 1.04,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(lockPulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // 500ms — Header
    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(headerTranslateY, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }, 500),
    );

    // 1100ms — Subtext
    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(subtextOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(subtextTranslateY, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1100),
    );

    // 2000ms+ — Bullets, 1s apart
    BULLETS.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(bulletAnims[i].opacity, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(bulletAnims[i].translateY, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]).start();
        }, 2000 + i * 1000),
      );
    });

    // CTA after last bullet
    const buttonDelay = 2000 + BULLETS.length * 1000 + 400;
    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, buttonDelay),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    lockOpacity,
    lockPulse,
    headerOpacity,
    headerTranslateY,
    subtextOpacity,
    subtextTranslateY,
    bulletAnims,
    buttonOpacity,
  ]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
    <ScreenContainer>
      <ProgressIndicator current={7} total={13} />

      <View style={styles.body}>
        {/* Minimal lock icon — white, thin, small */}
        <Animated.View
          style={[
            styles.lockWrap,
            {
              opacity: lockOpacity,
              transform: [{ scale: lockPulse }],
            },
          ]}
        >
          <View style={styles.lockOuter}>
            <View style={styles.lockShackle} />
            <View style={styles.lockBody}>
              <View style={styles.lockKeyhole} />
            </View>
          </View>
        </Animated.View>

        {/* Headline — heavier */}
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          This isn't motivation.
        </Animated.Text>

        {/* Subtext */}
        <Animated.Text
          style={[
            styles.subtext,
            {
              opacity: subtextOpacity,
              transform: [{ translateY: subtextTranslateY }],
            },
          ]}
        >
          This is a daily conditioning protocol.
        </Animated.Text>

        {/* Bullets — compact */}
        <View style={styles.bullets}>
          {BULLETS.map((item, i) => (
            <Animated.Text
              key={item}
              style={[
                styles.bullet,
                {
                  opacity: bulletAnims[i].opacity,
                  transform: [{ translateY: bulletAnims[i].translateY }],
                },
              ]}
            >
              {item}
            </Animated.Text>
          ))}
        </View>
      </View>

      {/* CTA — declarative */}
      <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Animated.timing(screenOpacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }).start(() => {
              navigation.navigate('Projection');
            });
          }}
          activeOpacity={0.85}
          style={styles.ctaButton}
        >
          <Text style={styles.ctaText}>Continue →</Text>
        </TouchableOpacity>
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
  // ── Lock icon — minimal, monochrome, mechanical ──
  lockWrap: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  lockOuter: {
    alignItems: 'center',
  },
  lockShackle: {
    width: 16,
    height: 11,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: -1,
  },
  lockBody: {
    width: 24,
    height: 18,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  lockKeyhole: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textSecondary,
  },
  // ── Text — tighter, heavier ──
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 36,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtext: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
    marginBottom: 22,
  },
  bullets: {
    gap: 10,
  },
  bullet: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.textSecondary,
    letterSpacing: -0.1,
  },
  // ── CTA ──
  buttonWrap: {
    paddingBottom: 32,
    alignItems: 'center',
  },
  ctaButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  ctaText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 17,
    color: Colors.textSecondary,
  },
});

export default MechanismIntroScreen;
