/**
 * SessionScreen — Active Lock In session.
 *
 * Entry: Starts at solid black, fades in micro text, then countdown.
 * Timer: Real-time calculation from timestamps (no interval drift).
 * Exit: Hold-to-unlock (2s long press) or timer completion.
 * Resilience: BackHandler blocks back, AppState recalculates on foreground.
 *
 * TODO: Brightness dimming — needs native module. Placeholder for Phase 2+.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  AppStateStatus,
  BackHandler,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { useSession } from './state/SessionProvider';
import { getRemaining, getPhaseText } from './engine/SessionEngine';
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';

type Props = NativeStackScreenProps<MainStackParamList, 'Session'>;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const HOLD_DURATION = 2000; // 2 seconds to unlock

const SessionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { duration, resuming } = route.params;
  const { state, dispatch } = useSession();

  // ── Timer state ──
  const [remaining, setRemaining] = useState(() => {
    if (state.activeSession) {
      return getRemaining(state.activeSession.expectedEndTimestamp);
    }
    return duration * 60;
  });
  const [isComplete, setIsComplete] = useState(false);

  // ── Entry animation ──
  const microTextOpacity = useRef(new Animated.Value(0)).current;
  const timerOpacity = useRef(new Animated.Value(0)).current;
  const completeTextOpacity = useRef(new Animated.Value(0)).current;

  // ── Hold-to-unlock ──
  const [holdProgress, setHoldProgress] = useState(0);
  const holdStartRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdRingScale = useRef(new Animated.Value(0)).current;

  // ── Tick interval ──
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = duration * 60;

  // ── Entry animation sequence ──
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 300ms: micro text fades in
    timers.push(
      setTimeout(() => {
        Animated.timing(microTextOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 300),
    );

    // 1200ms: micro text fades out, timer fades in
    timers.push(
      setTimeout(() => {
        Animated.timing(microTextOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start();
        Animated.timing(timerOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      }, 1200),
    );

    return () => timers.forEach(clearTimeout);
  }, [microTextOpacity, timerOpacity]);

  // ── Real-time timer tick ──
  useEffect(() => {
    if (isComplete) return;
    if (!state.activeSession) return;

    tickRef.current = setInterval(() => {
      const r = getRemaining(state.activeSession!.expectedEndTimestamp);
      setRemaining(r);

      if (r <= 0) {
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = null;
        handleTimerComplete();
      }
    }, 250); // Check 4x/sec for responsive display

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state.activeSession, isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer completion ──
  const handleTimerComplete = useCallback(() => {
    if (isComplete) return;
    setIsComplete(true);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    dispatch({
      type: 'COMPLETE_SESSION',
      payload: { durationMinutes: duration },
    });

    // Show "Session Complete" text
    Animated.timing(completeTextOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // After 1.5s, fade everything and navigate to fresh Home
    setTimeout(() => {
      Animated.timing(timerOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        navigation.replace('Home');
      });
    }, 1500);
  }, [isComplete, dispatch, duration, completeTextOpacity, timerOpacity, navigation]);

  // ── Hold-to-unlock handlers ──
  const handleHoldStart = useCallback(() => {
    holdStartRef.current = Date.now();

    Animated.timing(holdRingScale, {
      toValue: 1,
      duration: HOLD_DURATION,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    holdIntervalRef.current = setInterval(() => {
      if (!holdStartRef.current) return;
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(1, elapsed / HOLD_DURATION);
      setHoldProgress(progress);

      // Haptic pulse every 500ms
      if (elapsed % 500 < 50) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (progress >= 1) {
        // Unlock!
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        holdStartRef.current = null;
        handleHoldComplete();
      }
    }, 50);
  }, [holdRingScale]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleHoldRelease = useCallback(() => {
    holdStartRef.current = null;
    setHoldProgress(0);

    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }

    Animated.timing(holdRingScale, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [holdRingScale]);

  const handleHoldComplete = useCallback(() => {
    setIsComplete(true);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    dispatch({
      type: 'COMPLETE_SESSION',
      payload: { durationMinutes: duration },
    });

    // Fade out and navigate to fresh Home
    Animated.timing(timerOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.replace('Home');
    });
  }, [dispatch, duration, timerOpacity, navigation]);

  // ── BackHandler: block Android back ──
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => handler.remove();
  }, []);

  // ── AppState: recalculate on foreground ──
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active' && state.activeSession) {
          const r = getRemaining(state.activeSession.expectedEndTimestamp);
          setRemaining(r);
          if (r <= 0) {
            handleTimerComplete();
          }
        }
      },
    );
    return () => subscription.remove();
  }, [state.activeSession, handleTimerComplete]);

  // Cleanup hold interval on unmount
  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  const elapsed = totalSeconds - remaining;
  const phaseText = getPhaseText(elapsed, totalSeconds);

  return (
    <View style={styles.container}>
      {/* Micro text: "X minutes. No exits." */}
      <Animated.View style={[styles.centerContent, { opacity: microTextOpacity }]}>
        <Text style={styles.microText}>
          {duration} minutes. No exits.
        </Text>
      </Animated.View>

      {/* Timer + Phase text */}
      <Animated.View style={[styles.centerContent, { opacity: timerOpacity }]}>
        {!isComplete ? (
          <>
            <Text style={styles.timer}>{formatTime(remaining)}</Text>
            <Text style={styles.phaseText}>{phaseText}</Text>
          </>
        ) : (
          <Animated.Text style={[styles.completeText, { opacity: completeTextOpacity }]}>
            Session Complete.
          </Animated.Text>
        )}
      </Animated.View>

      {/* Hold-to-unlock button at bottom */}
      {!isComplete && (
        <View style={styles.holdSection}>
          <View
            style={styles.holdButton}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldRelease}
            onTouchCancel={handleHoldRelease}
          >
            {/* Progress ring */}
            <Animated.View
              style={[
                styles.holdRing,
                {
                  transform: [{ scale: holdRingScale }],
                  opacity: holdProgress > 0 ? 0.4 : 0,
                },
              ]}
            />
            {/* Lock icon (simple view-based) */}
            <View style={styles.holdLockBody}>
              <View style={styles.holdLockShackle} />
            </View>
          </View>
          <Text style={styles.holdHint}>Hold to end session</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lockInBackground,
  },
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  microText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  timer: {
    fontFamily: FontFamily.headingBold,
    fontSize: 72,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginBottom: 24,
  },
  phaseText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  completeText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    color: Colors.textPrimary,
    letterSpacing: -0.6,
  },
  // ── Hold-to-unlock ──
  holdSection: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  holdButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  holdRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  holdLockBody: {
    width: 18,
    height: 14,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
    alignItems: 'center',
    opacity: 0.5,
  },
  holdLockShackle: {
    position: 'absolute',
    top: -8,
    width: 12,
    height: 10,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: Colors.textMuted,
    backgroundColor: 'transparent',
  },
  holdHint: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
    opacity: 0.4,
    letterSpacing: 0.3,
  },
});

export default SessionScreen;
