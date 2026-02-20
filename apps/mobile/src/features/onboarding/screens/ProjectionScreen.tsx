import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

// ─── Content ───
const BULLETS = [
  'No emotional spikes',
  'No dopamine spirals',
  'No skipped sessions',
  'Momentum becomes default',
];

const SLIDE = 25;
const { width: SCREEN_W } = Dimensions.get('window');

// ─── EKG bar configuration ───
const BAR_W = 2;
const BAR_GAP = 1;
const HORIZONTAL_PAD = 24; // matches ScreenContainer padding
const USABLE_W = SCREEN_W - HORIZONTAL_PAD * 2;
const NUM_BARS = Math.floor(USABLE_W / (BAR_W + BAR_GAP));
const SWEEP_MS = 2200; // one full scan cycle

// QRS spike shape — relative heights
// Positive = above baseline, negative = below
const SPIKE_SHAPE = [1.2, 2.5, 5, 16, -9, 3.5, 1.8, 1];

// Place 3 peaks evenly across the bar array
const PEAK_COUNT = 3;
const SEGMENT = Math.floor(NUM_BARS / PEAK_COUNT);
const PEAK_STARTS = Array.from(
  { length: PEAK_COUNT },
  (_, i) => Math.floor(SEGMENT * (i + 0.5)) - Math.floor(SPIKE_SHAPE.length / 2),
);

// Build a lookup: barIndex → spike multiplier (or 0 for flat)
const SPIKE_MAP = new Map<number, number>();
PEAK_STARTS.forEach((start) => {
  SPIKE_SHAPE.forEach((val, si) => {
    SPIKE_MAP.set(start + si, val);
  });
});

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Projection'>;

const ProjectionScreen: React.FC<Props> = ({ navigation }) => {
  const [isFlatlining, setIsFlatlining] = useState(false);

  // ── Signal bar pulse ──
  const signalOpacity = useRef(new Animated.Value(0.08)).current;

  // ── Content animations ──
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const bulletAnims = useRef(
    BULLETS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(SLIDE),
    })),
  ).current;
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // ── EKG sweep value (0→1 linear loop) ──
  const sweep = useRef(new Animated.Value(0)).current;
  const sweepLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Flatline transition ──
  const ekgOpacity = useRef(new Animated.Value(1)).current;
  const pageOpacity = useRef(new Animated.Value(1)).current;

  // ── Content entrance sequence ──
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Signal bar pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(signalOpacity, {
          toValue: 0.35,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(signalOpacity, {
          toValue: 0.06,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Header
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Bullets staggered
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
        }, 1000 + i * 1000),
      );
    });

    const subtextDelay = 1000 + BULLETS.length * 1000 + 600;
    timers.push(
      setTimeout(() => {
        Animated.timing(subtextOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      }, subtextDelay),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, subtextDelay + 800),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    signalOpacity,
    headerOpacity,
    headerTranslateY,
    bulletAnims,
    subtextOpacity,
    buttonOpacity,
  ]);

  // ── EKG sweep loop ──
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: SWEEP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    sweepLoop.current = loop;
    loop.start();

    return () => loop.stop();
  }, [sweep]);

  // ── Build bar opacity interpolations from sweep ──
  const barInterpolations = useRef(
    Array.from({ length: NUM_BARS }, (_, i) => {
      const p = i / (NUM_BARS - 1);
      const isSpike = SPIKE_MAP.has(i);

      const lead = 0.03;
      const trail = 0.10;

      const inputRange = [
        Math.max(0, p - lead),
        p,
        Math.min(1, p + trail * 0.3),
        Math.min(1, p + trail),
      ];

      const outputRange = isSpike
        ? [0, 1, 0.6, 0]
        : [0.10, 0.40, 0.25, 0.10];

      return {
        opacity: sweep.interpolate({
          inputRange,
          outputRange,
          extrapolate: 'clamp',
        }),
        isSpike,
      };
    }),
  ).current;

  // ── Handle "Begin Lock In" ──
  const handleBeginLockIn = useCallback(() => {
    if (isFlatlining) return;
    setIsFlatlining(true);

    // Stop sweep loop
    sweepLoop.current?.stop();

    // Flatline: fade out all EKG spike bars, keep baseline dim
    Animated.timing(ekgOpacity, {
      toValue: 0,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    // After a beat, fade out the entire page
    setTimeout(() => {
      Animated.timing(pageOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        navigation.navigate('ScreenTimePermission');
      });
    }, 500);
  }, [isFlatlining, ekgOpacity, pageOpacity, navigation]);

  // ── Compute bar heights ──
  const getBarStyle = (index: number) => {
    const multiplier = SPIKE_MAP.get(index);
    if (multiplier === undefined) {
      return { height: 2, translateY: 0 };
    }
    const h = Math.abs(multiplier) * 3;
    const ty = multiplier > 0 ? -(h / 2) + 1 : h / 2 - 1;
    return { height: h, translateY: ty };
  };

  return (
    <Animated.View style={[styles.pageWrap, { opacity: pageOpacity }]}>
      <ScreenContainer>
        <ProgressIndicator current={6} total={11} />

        <Animated.View style={[styles.signalBar, { opacity: signalOpacity }]} />

        <View style={styles.body}>
          <Animated.View
            style={{
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
            }}
          >
            <Text style={styles.title}>90 days.{'\n'}No excuses.</Text>
            <View style={styles.headlineDivider} />
          </Animated.View>

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

          <Animated.Text style={[styles.doctrine, { opacity: subtextOpacity }]}>
            Identity is built by what you repeat.
          </Animated.Text>
        </View>

        {/* ── EKG Heartbeat Line ── */}
        <Animated.View style={[styles.ekgWrap, { opacity: buttonOpacity }]}>
          <View style={styles.ekgContainer}>
            {barInterpolations.map((bar, i) => {
              const { height, translateY } = getBarStyle(i);
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.ekgBar,
                    {
                      height,
                      opacity: bar.isSpike
                        ? Animated.multiply(bar.opacity, ekgOpacity)
                        : bar.opacity,
                      transform: [{ translateY }],
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Static flatline baseline — always visible */}
          <View style={styles.ekgBaseline} />
        </Animated.View>

        {/* ── CTA ── */}
        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={handleBeginLockIn}
            activeOpacity={0.9}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Begin Lock In</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pageWrap: {
    flex: 1,
  },
  signalBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.primary,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 4,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 44,
    letterSpacing: -1,
    lineHeight: 48,
    color: Colors.textPrimary,
  },
  headlineDivider: {
    width: 32,
    height: 2,
    backgroundColor: Colors.primary,
    marginTop: 16,
    marginBottom: 28,
    opacity: 0.6,
  },
  bullets: {
    gap: 12,
    marginBottom: 28,
  },
  bullet: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.textSecondary,
    letterSpacing: -0.1,
  },
  doctrine: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    opacity: 0.55,
  },
  // ── EKG line ──
  ekgWrap: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  ekgContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    width: '100%',
    justifyContent: 'space-between',
  },
  ekgBar: {
    width: BAR_W,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
  ekgBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.primary,
    opacity: 0.1,
  },
  // ── CTA ──
  buttonWrap: {
    paddingBottom: 32,
    paddingHorizontal: 4,
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

export default ProjectionScreen;
