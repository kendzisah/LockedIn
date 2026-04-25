/**
 * ExecutionBlockScreen — Custom-duration focus session.
 *
 * Standalone lockdown timer (not tied to 90-day program, streaks, or audio).
 * Receives durationMinutes from route params. Uses LockModeService to shield apps.
 * Hold-to-unlock (2s) for early exit. Navigates to SessionComplete on finish.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  type AppStateStatus,
  BackHandler,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { useSession } from './state/SessionProvider';
import { useOnboarding } from '../onboarding/state/OnboardingProvider';
import { getTodayKey, computeNewStreak } from './engine/SessionEngine';
import { LockModeService } from '../../services/LockModeService';
import { NotificationService } from '../../services/NotificationService';
import { Analytics } from '../../services/AnalyticsService';
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';

export const ACTIVE_EB_KEY = '@lockedin/active_execution_block';

const HOLD_DURATION = 2000;

const PHASE_TEXTS = [
  'You are now Locked In.',
  'Stay Locked In.',
  'Execute.',
  'No distractions.',
  'Build the standard.',
];

type Props = NativeStackScreenProps<MainStackParamList, 'ExecutionBlock'>;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getPhaseText(elapsed: number, total: number): string {
  const pct = total > 0 ? elapsed / total : 0;
  if (pct < 0.2) return PHASE_TEXTS[0];
  if (pct < 0.4) return PHASE_TEXTS[1];
  if (pct < 0.6) return PHASE_TEXTS[2];
  if (pct < 0.8) return PHASE_TEXTS[3];
  return PHASE_TEXTS[4];
}

const ExecutionBlockScreen: React.FC<Props> = ({ navigation, route }) => {
  const { durationMinutes, resumeEndTimestamp } = route.params;
  const isResume = resumeEndTimestamp != null;
  const { state, dispatch } = useSession();
  const { state: onboardingState } = useOnboarding();
  useKeepAwake();

  const totalSeconds = durationMinutes * 60;
  const endTimestampRef = useRef(resumeEndTimestamp ?? Date.now() + totalSeconds * 1000);
  const [remaining, setRemaining] = useState(totalSeconds);
  const [isComplete, setIsComplete] = useState(false);

  const timerOpacity = useRef(new Animated.Value(0)).current;
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const computeStreakAfterCompletion = useCallback((sessionMinutes: number) => {
    const todayKey = getTodayKey();
    const dailyCommitment = onboardingState.dailyMinutes ?? 60;
    const currentFocused = state.dailyFocusDate === todayKey ? state.dailyFocusedMinutes : 0;
    const newFocused = currentFocused + sessionMinutes;
    const goalAlreadyMet = state.dailyGoalMetDate === todayKey;

    if (newFocused >= dailyCommitment && !goalAlreadyMet) {
      dispatch({ type: 'DAILY_GOAL_MET' });
      Analytics.track('Daily Goal Met', {
        daily_commitment: dailyCommitment,
        actual_minutes: newFocused,
      });
      const newStreak = computeNewStreak(state.lastSessionDayKey, state.consecutiveStreak, todayKey);
      return newStreak;
    }
    return 0;
  }, [state, onboardingState.dailyMinutes, dispatch]);

  // Hold-to-unlock
  const [holdProgress, setHoldProgress] = useState(0);
  const holdStartRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdRingScale = useRef(new Animated.Value(0)).current;

  const getElapsedMinutes = useCallback(() => {
    const elapsedSeconds = totalSeconds - Math.max(0, Math.ceil((endTimestampRef.current - Date.now()) / 1000));
    return Math.max(1, Math.ceil(elapsedSeconds / 60));
  }, [totalSeconds]);

  const handleTimerComplete = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsComplete(true);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    LockModeService.endSession();
    NotificationService.cancelExecutionBlockDone();
    await AsyncStorage.removeItem(ACTIVE_EB_KEY);

    dispatch({
      type: 'COMPLETE_EXECUTION_BLOCK',
      payload: { durationMinutes },
    });
    void NotificationService.onSessionCompletedToday();

    const resultStreak = computeStreakAfterCompletion(durationMinutes);

    Analytics.track('Session Completed', {
      type: 'execution_block',
      duration_minutes: durationMinutes,
      streak_day: resultStreak || state.consecutiveStreak,
    });

    Animated.timing(timerOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.replace('SessionComplete', {
        phase: 'execution_block',
        durationMinutes,
        streak: resultStreak,
      });
    });
  }, [dispatch, durationMinutes, timerOpacity, navigation, computeStreakAfterCompletion, state.consecutiveStreak]);

  const handleHoldComplete = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsComplete(true);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    LockModeService.endSession();
    NotificationService.cancelExecutionBlockDone();
    await AsyncStorage.removeItem(ACTIVE_EB_KEY);

    const elapsedSeconds = totalSeconds - Math.max(0, Math.ceil((endTimestampRef.current - Date.now()) / 1000));

    Analytics.track('Session Abandoned', {
      type: 'execution_block',
      duration_minutes: durationMinutes,
      elapsed_seconds: elapsedSeconds,
      reason: 'hold_to_unlock',
    });

    if (elapsedSeconds < 60) {
      navigation.replace('Tabs' as any);
      return;
    }

    const actualMinutes = Math.ceil(elapsedSeconds / 60);

    dispatch({
      type: 'COMPLETE_EXECUTION_BLOCK',
      payload: { durationMinutes: actualMinutes },
    });
    void NotificationService.onSessionCompletedToday();

    const resultStreak = computeStreakAfterCompletion(actualMinutes);

    Animated.timing(timerOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.replace('SessionComplete', {
        phase: 'execution_block',
        durationMinutes: actualMinutes,
        streak: resultStreak,
      });
    });
  }, [dispatch, durationMinutes, totalSeconds, timerOpacity, navigation, computeStreakAfterCompletion, state.consecutiveStreak]);

  // Persist execution block info, schedule notification, fade in timer
  useEffect(() => {
    if (!isResume) {
      AsyncStorage.setItem(
        ACTIVE_EB_KEY,
        JSON.stringify({
          startTimestamp: Date.now(),
          endTimestamp: endTimestampRef.current,
          durationMinutes,
        }),
      );

      Analytics.track('Session Started', {
        type: 'execution_block',
        duration_minutes: durationMinutes,
        streak_day: state.consecutiveStreak,
      });
      Analytics.timeEvent('Session Completed');
    } else {
      Analytics.track('Session Resumed', {
        type: 'execution_block',
        duration_minutes: durationMinutes,
        remaining_seconds: Math.max(0, Math.ceil((endTimestampRef.current - Date.now()) / 1000)),
      });
    }

    // Idempotent — scheduleExecutionBlockDone cancels any existing notification
    // with the same ID before scheduling, so calling on resume is safe.
    NotificationService.scheduleExecutionBlockDone(new Date(endTimestampRef.current));

    Animated.timing(timerOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [timerOpacity]);

  // Timer tick — uses wall-clock time so backgrounding doesn't drift
  useEffect(() => {
    if (isComplete) return;

    tickRef.current = setInterval(() => {
      const r = Math.max(0, Math.ceil((endTimestampRef.current - Date.now()) / 1000));
      setRemaining(r);

      if (r <= 0) {
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = null;
        handleTimerComplete();
      }
    }, 250);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isComplete, handleTimerComplete]);

  // Re-sync timer when app returns to foreground (covers sleep / background)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active' && !isComplete) {
          const r = Math.max(0, Math.ceil((endTimestampRef.current - Date.now()) / 1000));
          setRemaining(r);
          if (r <= 0) {
            handleTimerComplete();
          }
        }
      },
    );
    return () => subscription.remove();
  }, [isComplete, handleTimerComplete]);

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

      if (elapsed % 500 < 50) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (progress >= 1) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        holdStartRef.current = null;
        handleHoldComplete();
      }
    }, 50);
  }, [holdRingScale, handleHoldComplete]);

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

  // Block Android back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => handler.remove();
  }, []);

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
      <Animated.View style={[styles.centerContent, { opacity: timerOpacity }]}>
        <Text style={styles.timer}>{formatTime(remaining)}</Text>
        <Text style={styles.phaseText}>{phaseText}</Text>
      </Animated.View>

      {!isComplete && (
        <View style={styles.holdSection}>
          <View
            style={styles.holdButton}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldRelease}
            onTouchCancel={handleHoldRelease}
          >
            <Animated.View
              style={[
                styles.holdRing,
                {
                  transform: [{ scale: holdRingScale }],
                  opacity: holdProgress > 0 ? 0.4 : 0,
                },
              ]}
            />
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

export default ExecutionBlockScreen;
