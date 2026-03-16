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
 * CTA modes (from ClockService.getCTAState):
 *   lock_in              → progress ≈ 0.381 (open)  | "Tap to Lock In"
 *   lock_in_done_waiting → progress = 0 (closed)    | "Locked In Today" + hint
 *   unlock               → progress = 0 (closed)    | "Tap to Reflect"
 *   all_done             → progress ≈ 0.381 (open)  | "Complete Today"
 *
 * On tap: animate lock closed → fire onAnimationComplete.
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
import type { CTAMode } from '../../../services/ClockService';

interface LockButtonProps {
  ctaMode: CTAMode;
  hint?: string;
  isSubscribed: boolean;
  onAnimationComplete: () => void;
}

// ── Lottie frame constants ──────────────────────────────────
const OPEN_FRAME = 69;
const TOTAL_OP = 181;
const OPEN_PROGRESS = OPEN_FRAME / TOTAL_OP;
const CLOSED_PROGRESS = 0;
const CLOSE_DURATION = 1400;

const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

// ── Label + accent per CTA mode ──
function getLabelForMode(mode: CTAMode): string {
  switch (mode) {
    case 'lock_in': return 'Tap to Lock In';
    case 'unlock': return 'Tap to Reflect';
    case 'lock_in_done_waiting': return 'Locked In Today';
    case 'all_done': return 'Complete';
  }
}

function isTappable(mode: CTAMode): boolean {
  return mode === 'lock_in' || mode === 'unlock';
}

const SHAKE_DURATION = 80;
const SHAKE_MAGNITUDE = 8;

const LockButton: React.FC<LockButtonProps> = ({ ctaMode, hint, isSubscribed, onAnimationComplete }) => {
  const { state, dispatch } = useSession();
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const lottieProgress = useRef(new Animated.Value(OPEN_PROGRESS)).current;
  const shakeX = useRef(new Animated.Value(0)).current;

  const isIdle = state.phase === 'IDLE';
  const isAnimating = state.phase === 'ANIMATING';
  const tappable = isTappable(ctaMode);

  // ── Sync visual state with CTA mode ──
  useEffect(() => {
    if (ctaMode === 'lock_in' || ctaMode === 'all_done') {
      // Open lock: ready to lock in, or day complete (unlocked after reflect)
      lottieProgress.setValue(OPEN_PROGRESS);
      labelOpacity.setValue(1);
    } else {
      // Closed lock: locked in today (waiting) or tap to reflect
      lottieProgress.setValue(CLOSED_PROGRESS);
      labelOpacity.setValue(1);
    }
  }, [ctaMode, lottieProgress, labelOpacity]);

  // ── Tap handler ──
  const runShake = useCallback(() => {
    const shakes = Array.from({ length: 4 }, (_, i) => {
      const dir = i % 2 === 0 ? SHAKE_MAGNITUDE : -SHAKE_MAGNITUDE;
      return Animated.timing(shakeX, {
        toValue: dir,
        duration: SHAKE_DURATION,
        useNativeDriver: true,
      });
    });
    return Animated.sequence([
      ...shakes,
      Animated.timing(shakeX, { toValue: 0, duration: SHAKE_DURATION, useNativeDriver: true }),
    ]);
  }, [shakeX]);

  const handlePress = useCallback(() => {
    if (!isIdle || !tappable) return;

    if (ctaMode === 'lock_in') {
      dispatch({ type: 'SET_ANIMATING' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      Animated.timing(labelOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();

      Animated.timing(lottieProgress, {
        toValue: CLOSED_PROGRESS,
        duration: CLOSE_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        if (!isSubscribed) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          runShake().start(() => {
            Animated.timing(lottieProgress, {
              toValue: OPEN_PROGRESS,
              duration: 600,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }).start();
            Animated.timing(labelOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }).start();
            dispatch({ type: 'RESET_PHASE' });
            onAnimationComplete();
          });
        } else {
          onAnimationComplete();
        }
      });
    } else if (ctaMode === 'unlock') {
      if (!isSubscribed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        runShake().start(() => onAnimationComplete());
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onAnimationComplete();
    }
  }, [isIdle, tappable, ctaMode, dispatch, labelOpacity, lottieProgress, onAnimationComplete, isSubscribed, runShake]);

  // ── Label styling based on mode ──
  const labelStyle = [
    styles.label,
    ctaMode === 'unlock' && styles.labelUnlock,
    ctaMode === 'lock_in_done_waiting' && styles.labelMuted,
    ctaMode === 'all_done' && styles.labelComplete,
    { opacity: labelOpacity },
  ];

  return (
    <View style={styles.container} pointerEvents={isAnimating ? 'none' : 'auto'}>
      <TouchableWithoutFeedback onPress={handlePress} disabled={!tappable}>
        <Animated.View style={[styles.lottieWrap, { transform: [{ translateX: shakeX }] }]}>
          <AnimatedLottieView
            source={require('../../../../assets/lottie/lock_close.json')}
            progress={lottieProgress}
            style={[
              styles.lottie,
              ctaMode === 'lock_in_done_waiting' && styles.lottieMuted,
            ]}
          />
        </Animated.View>
      </TouchableWithoutFeedback>

      <Animated.Text style={labelStyle}>
        {getLabelForMode(ctaMode)}
      </Animated.Text>

      {hint ? (
        <Animated.Text style={[styles.hint, { opacity: labelOpacity }]}>
          {hint}
        </Animated.Text>
      ) : null}
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
  lottieMuted: {
    opacity: 0.5,
  },
  label: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  labelUnlock: {
    color: Colors.textSecondary,
    opacity: 0.8,
  },
  labelMuted: {
    color: Colors.textMuted,
    opacity: 0.6,
  },
  labelComplete: {
    color: Colors.accent,
    opacity: 0.9,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 6,
    letterSpacing: 0.3,
  },
});

export default React.memo(LockButton);
