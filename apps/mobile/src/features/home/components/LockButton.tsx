/**
 * LockButton — Ritual centerpiece of the home screen.
 *
 * Uses lock_close.json Lottie driven by an Animated.Value `progress` prop.
 *
 * The Lottie JSON frames:
 *   Frame 0  = closed lock (settled)
 *   Frame 69 = open lock (shackle up)
 *   Frame 180 = open lock (static tail)
 *
 * Our mapping:
 *   IDLE + !completed  → progress ≈ 0.381 (open, frame 69)
 *   On tap             → animate progress 0.381 → 0 (close)
 *   IDLE + completed   → progress = 0 (closed, frame 0)
 *
 * Double-tap guard: only triggers from IDLE && !completedToday.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { useSession } from '../state/SessionProvider';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

interface LockButtonProps {
  onAnimationComplete: () => void;
}

// ── Lottie frame constants ──────────────────────────────────
const OPEN_FRAME = 69;
const TOTAL_OP = 181;                            // "op" in the JSON (exclusive end)
const OPEN_PROGRESS = OPEN_FRAME / TOTAL_OP;     // ≈ 0.381
const CLOSED_PROGRESS = 0;                        // frame 0

const CLOSE_DURATION = 1400; // ms for the closing animation

// Wrap LottieView so Animated can drive its `progress` prop natively
const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

const LockButton: React.FC<LockButtonProps> = ({ onAnimationComplete }) => {
  const { state, dispatch } = useSession();
  const labelOpacity = useRef(new Animated.Value(1)).current;

  // Lottie progress: OPEN_PROGRESS = open, 0 = closed
  const lottieProgress = useRef(new Animated.Value(OPEN_PROGRESS)).current;

  const isIdle = state.phase === 'IDLE';
  const isAnimating = state.phase === 'ANIMATING';
  const isCompleted = state.completedToday;

  // ── Sync visual state with session phase ──
  useEffect(() => {
    if (isCompleted) {
      lottieProgress.setValue(CLOSED_PROGRESS);
      labelOpacity.setValue(1);
    } else if (isIdle) {
      lottieProgress.setValue(OPEN_PROGRESS);
      labelOpacity.setValue(1);
    }
  }, [isCompleted, isIdle, lottieProgress, labelOpacity]);

  // ── Tap handler: close the lock ──
  const handlePress = useCallback(() => {
    // Double-tap guard
    if (!isIdle || isCompleted) return;

    dispatch({ type: 'SET_ANIMATING' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Fade out label
    Animated.timing(labelOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Animate lock from open → closed
    Animated.timing(lottieProgress, {
      toValue: CLOSED_PROGRESS,
      duration: CLOSE_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // progress not on native thread
    }).start(() => {
      onAnimationComplete();
    });
  }, [isIdle, isCompleted, dispatch, labelOpacity, lottieProgress, onAnimationComplete]);

  return (
    <View style={styles.container} pointerEvents={isAnimating ? 'none' : 'auto'}>
      <TouchableWithoutFeedback onPress={handlePress} disabled={isCompleted}>
        <View style={styles.lottieWrap}>
          <AnimatedLottieView
            source={require('../../../../assets/lottie/lock_close.json')}
            progress={lottieProgress}
            style={styles.lottie}
          />
        </View>
      </TouchableWithoutFeedback>

      <Animated.Text
        style={[
          styles.label,
          isCompleted && styles.labelCompleted,
          { opacity: labelOpacity },
        ]}
      >
        {isCompleted ? 'Locked In Today' : 'Tap to Lock In'}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottieWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: 160,
    height: 160,
  },
  label: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  labelCompleted: {
    color: Colors.textMuted,
    opacity: 0.6,
  },
});

export default React.memo(LockButton);
