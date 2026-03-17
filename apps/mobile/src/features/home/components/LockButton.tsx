/**
 * LockButton — Always-open lock that animates closed on tap.
 *
 * Triggers the execution block (focus timer) flow.
 * Always shows open lock + "Tap to Lock In".
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
  onPress: () => void;
  onAnimationComplete: () => void;
  animateLock: boolean;
}

const OPEN_FRAME = 69;
const TOTAL_OP = 181;
const OPEN_PROGRESS = OPEN_FRAME / TOTAL_OP;
const CLOSED_PROGRESS = 0;
const CLOSE_DURATION = 1400;

const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

const LockButton: React.FC<LockButtonProps> = ({ onPress, onAnimationComplete, animateLock }) => {
  const { state } = useSession();
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const lottieProgress = useRef(new Animated.Value(OPEN_PROGRESS)).current;

  const isIdle = state.phase === 'IDLE';
  const isAnimating = state.phase === 'ANIMATING';

  useEffect(() => {
    if (!animateLock) {
      lottieProgress.setValue(OPEN_PROGRESS);
      labelOpacity.setValue(1);
      return;
    }

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
      onAnimationComplete();
      setTimeout(() => {
        lottieProgress.setValue(OPEN_PROGRESS);
        labelOpacity.setValue(1);
      }, 500);
    });
  }, [animateLock]);

  const handlePress = useCallback(() => {
    if (!isIdle) return;
    onPress();
  }, [isIdle, onPress]);

  return (
    <View style={styles.container} pointerEvents={isAnimating ? 'none' : 'auto'}>
      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.lottieWrap}>
          <AnimatedLottieView
            source={require('../../../../assets/lottie/lock_close.json')}
            progress={lottieProgress}
            style={styles.lottie}
          />
        </View>
      </TouchableWithoutFeedback>

      <Animated.Text style={[styles.label, { opacity: labelOpacity }]}>
        Tap to Lock In
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
});

export default React.memo(LockButton);
