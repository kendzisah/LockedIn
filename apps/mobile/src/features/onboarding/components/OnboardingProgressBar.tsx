/**
 * OnboardingProgressBar — Persistent progress bar mounted above the
 * onboarding stack. Reads the active route name and smoothly animates
 * the fill as the user advances.
 *
 * Why this exists: when each screen rendered its own <ProgressIndicator>,
 * the fill width changed instantly on screen mount with no animation —
 * progress felt jarring. Lifting the bar above the navigator lets it
 * persist across screen transitions and tween between steps.
 *
 * Hidden routes (intro / immersive / paywall) animate the fill to 0
 * and reduce the bar's container height to 0 so they get a clean
 * full-bleed canvas.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationState } from '@react-navigation/native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';
import {
  SCREEN_STEP_MAP,
  TOTAL_STEPS,
  type OnboardingScreenName,
} from '../hooks/useOnboardingTracking';

/** Routes that should NOT show the progress bar (intro / ritual / paywall). */
const HIDDEN_ROUTES: ReadonlySet<OnboardingScreenName> = new Set([
  'Definition',
  'Commitment',
  'Paywall',
]);

const BAR_HEIGHT = 2;
const LABEL_HEIGHT = 14;
const VISIBLE_HEIGHT = 8 + LABEL_HEIGHT + 4 + BAR_HEIGHT + 1; // top + label + gap + bar + bottom
const TRANSITION_MS = 450;

const OnboardingProgressBar: React.FC = () => {
  const insets = useSafeAreaInsets();

  // Read the *focused* route inside the onboarding stack. Returns undefined
  // before the navigator hydrates.
  const routeName = useNavigationState((state) => {
    if (!state) return undefined;
    return state.routes[state.index]?.name as OnboardingScreenName | undefined;
  });

  const step = routeName ? SCREEN_STEP_MAP[routeName] ?? 0 : 0;
  const hidden = !routeName || HIDDEN_ROUTES.has(routeName);
  const targetProgress = hidden ? 0 : step / TOTAL_STEPS;

  const widthAnim = useRef(new Animated.Value(targetProgress)).current;
  const heightAnim = useRef(new Animated.Value(hidden ? 0 : VISIBLE_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(hidden ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: targetProgress,
      duration: TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.timing(heightAnim, {
      toValue: hidden ? 0 : VISIBLE_HEIGHT,
      duration: 250,
      useNativeDriver: false,
    }).start();
    Animated.timing(opacityAnim, {
      toValue: hidden ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [targetProgress, hidden, widthAnim, heightAnim, opacityAnim]);

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: Colors.background }}>
      {/* Outer wrapper animates height (JS-driven layout) */}
      <Animated.View style={[styles.container, { height: heightAnim }]}>
        {/* Inner wrapper animates opacity (native-driven, isolated node) */}
        <Animated.View style={{ opacity: opacityAnim, flex: 1 }}>
          <Text style={styles.stepLabel}>
            // STEP {String(step).padStart(2, '0')} / {TOTAL_STEPS}
          </Text>
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                {
                  width: widthAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            >
              <View style={styles.fillTip} />
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 1,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  stepLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: SystemTokens.textMuted,
    height: LABEL_HEIGHT,
    marginBottom: 4,
  },
  track: {
    height: BAR_HEIGHT,
    backgroundColor: SystemTokens.barTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: SystemTokens.glowAccent,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  fillTip: {
    width: 2,
    height: '100%',
    backgroundColor: SystemTokens.cyan,
    shadowColor: SystemTokens.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});

export default OnboardingProgressBar;
