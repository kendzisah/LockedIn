import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 25;

interface InkPoint {
  x: number;
  y: number;
}

type Stroke = InkPoint[];

function interpolateStroke(stroke: Stroke): InkPoint[] {
  if (stroke.length < 2) return stroke;
  const result: InkPoint[] = [stroke[0]];
  for (let i = 1; i < stroke.length; i++) {
    const prev = stroke[i - 1];
    const curr = stroke[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = 2;
    if (dist > step) {
      const steps = Math.ceil(dist / step);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        result.push({ x: prev.x + dx * t, y: prev.y + dy * t });
      }
    } else {
      result.push(curr);
    }
  }
  return result;
}

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'SignatureCommitment'
>;

const SignatureCommitmentScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [hasSigned, setHasSigned] = useState(false);

  // ── Screen-level fade ──
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // ── Staggered content ──
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const statementOpacity = useRef(new Animated.Value(0)).current;
  const statementTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const canvasOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 0ms — Title
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
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

    // 1600ms — Statement
    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(statementOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(statementTranslateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1600),
    );

    // 2600ms — Canvas
    timers.push(
      setTimeout(() => {
        Animated.timing(canvasOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 2600),
    );

    // 3200ms — Footer
    timers.push(
      setTimeout(() => {
        Animated.timing(footerOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 3200),
    );

    // 3800ms — Button
    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 3800),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    titleOpacity,
    titleTranslateY,
    subtextOpacity,
    statementOpacity,
    statementTranslateY,
    canvasOpacity,
    footerOpacity,
    buttonOpacity,
  ]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setStrokes((prev) => [...prev, [{ x: locationX, y: locationY }]]);
        if (!hasSigned) setHasSigned(true);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setStrokes((prev) => {
          const updated = [...prev];
          const last = [...updated[updated.length - 1], { x: locationX, y: locationY }];
          updated[updated.length - 1] = last;
          return updated;
        });
      },
    }),
  ).current;

  const handleClear = useCallback(() => {
    setStrokes([]);
    setHasSigned(false);
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
    <ScreenContainer>
      <ProgressIndicator current={13} total={13} />

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
          Commit to the standard.
        </Animated.Text>

        {/* Subtext */}
        <Animated.View style={{ opacity: subtextOpacity }}>
          <Text style={styles.subtextLine}>
            Discipline isn't intention.
          </Text>
          <Text style={styles.subtextEmphasis}>It's repetition.</Text>
        </Animated.View>

        {/* Commitment statement */}
        <Animated.Text
          style={[
            styles.statement,
            {
              opacity: statementOpacity,
              transform: [{ translateY: statementTranslateY }],
            },
          ]}
        >
          I commit to completing a daily Lock In session{'\n'}for the next 90
          days.
        </Animated.Text>

        {/* Signature canvas — View-based dot trail */}
        <Animated.View style={[styles.canvasWrap, { opacity: canvasOpacity }]}>
          <View style={styles.canvas} {...panResponder.panHandlers}>
            {strokes.map((stroke, si) =>
              interpolateStroke(stroke).map((p, pi) => (
                <View
                  key={`${si}-${pi}`}
                  style={[
                    styles.inkDot,
                    { left: p.x - 1.5, top: p.y - 1.5 },
                  ]}
                />
              )),
            )}
            {!hasSigned && (
              <Text style={styles.canvasPlaceholder}>Sign here</Text>
            )}
          </View>
          {hasSigned && (
            <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Footer */}
        <Animated.Text style={[styles.footer, { opacity: footerOpacity }]}>
          This is your agreement with yourself.
        </Animated.Text>
      </View>

      {/* CTA */}
      <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Animated.timing(screenOpacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }).start(() => {
              dispatch({ type: 'COMPLETE_ONBOARDING' });
            });
          }}
          activeOpacity={0.9}
          disabled={!hasSigned}
          style={[styles.ctaButton, !hasSigned && styles.ctaDisabled]}
        >
          <Text
            style={[styles.ctaText, !hasSigned && styles.ctaTextDisabled]}
          >
            I Commit
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
    justifyContent: 'center',
  },
  // ── Title ──
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    letterSpacing: -0.7,
    lineHeight: 38,
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  // ── Subtext ──
  subtextLine: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  subtextEmphasis: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
    marginBottom: 24,
  },
  // ── Statement ──
  statement: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 24,
  },
  // ── Signature canvas ──
  canvasWrap: {
    marginBottom: 16,
  },
  canvas: {
    height: 120,
    borderWidth: 1,
    borderColor: Colors.surface,
    borderRadius: 8,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  inkDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textPrimary,
  },
  canvasPlaceholder: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textMuted,
    opacity: 0.4,
  },
  clearText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 8,
    opacity: 0.6,
  },
  // ── Footer ──
  footer: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    letterSpacing: 0.3,
    opacity: 0.6,
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
  ctaDisabled: {
    backgroundColor: Colors.surface,
  },
  ctaText: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    letterSpacing: 0.2,
    color: Colors.textPrimary,
  },
  ctaTextDisabled: {
    color: Colors.textMuted,
  },
});

export default SignatureCommitmentScreen;
