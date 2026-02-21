/**
 * SessionScreen — Unified Lock In + Unlock/Reflect session.
 *
 * Accepts { phase, resuming } params.
 * - phase === 'lock_in': discipline mode, streak counts, crash-resume
 * - phase === 'unlock':  reflection mode, no streak, no crash-resume
 *
 * Timer duration:
 *   - When audio loads: timer = audio duration
 *   - When audio is unavailable: timer = 2:30 fallback
 *
 * Audio integration:
 *   1. Fetches session from SessionRepository (primary + fallback)
 *   2. Loads audio via AudioService (8s timeout)
 *   3. Falls back to 2:30 timer-only on failure (with single retry)
 *   4. Pauses on background, resumes on foreground
 *   5. Unloads on unmount
 *
 * Timer integrity: remaining is computed from endTimestampRef - Date.now().
 * The setInterval(250ms) is purely a render trigger — never accumulates time.
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
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { useSession } from './state/SessionProvider';
import { getRemaining, getPhaseText, getUnlockPhaseText, createSession } from './engine/SessionEngine';
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';
import { AudioService } from '../../services/AudioService';
import { SessionRepository, type TodaySession } from '../../services/SessionRepository';
import { ClockService } from '../../services/ClockService';
import { TelemetryService } from '../../services/TelemetryService';
import type { ContentPhase } from '@lockedin/shared-types';

const SESSION_DURATION = 5; // minutes — session duration in DB
const FALLBACK_SECONDS = 150; // 2:30 when audio is unavailable

type Props = NativeStackScreenProps<MainStackParamList, 'Session'>;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const HOLD_DURATION = 2000;

// ── Phase-dependent copy ──

function getMicroText(phase: ContentPhase): string {
  if (phase === 'unlock') return 'Reflect. Process. Release.';
  return 'Commit to the full timer.';
}

function getCompletionText(phase: ContentPhase): string {
  return phase === 'unlock' ? 'Reflection Complete.' : 'Session Complete.';
}

function getPhaseTextForPhase(
  phase: ContentPhase,
  elapsed: number,
  total: number,
): string {
  return phase === 'unlock'
    ? getUnlockPhaseText(elapsed, total)
    : getPhaseText(elapsed, total);
}

// ── Audio loading states ──
type AudioLoadState =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'failed'
  | 'retrying'
  | 'timer_only';

const SessionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phase, resuming } = route.params;
  const { state, dispatch } = useSession();

  // ── Timer state ──
  // totalSeconds adjusts when audio loads or fails:
  //   - Audio loaded → audio duration
  //   - Audio unavailable → FALLBACK_SECONDS (2:30)
  const [totalSeconds, setTotalSeconds] = useState(() => {
    // Crash-resume: use the stored session's remaining time
    if (phase === 'lock_in' && state.activeSession) {
      return Math.ceil(
        (state.activeSession.expectedEndTimestamp - state.activeSession.startTimestamp) / 1000,
      );
    }
    return FALLBACK_SECONDS;
  });

  const [remaining, setRemaining] = useState(() => {
    if (phase === 'lock_in' && state.activeSession) {
      return getRemaining(state.activeSession.expectedEndTimestamp);
    }
    return FALLBACK_SECONDS;
  });
  const [isComplete, setIsComplete] = useState(false);

  // ── Mutable end timestamp: adjusted when audio state resolves ──
  const endTimestampRef = useRef(
    phase === 'lock_in' && state.activeSession
      ? state.activeSession.expectedEndTimestamp
      : Date.now() + FALLBACK_SECONDS * 1000,
  );

  // ── Audio state ──
  const [audioState, setAudioState] = useState<AudioLoadState>('idle');
  const [sessionData, setSessionData] = useState<TodaySession | null>(null);
  const hasRetried = useRef(false);

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

  /**
   * Adjust the timer when we know the final duration.
   * Called after audio loads (use audio duration) or fails (keep fallback).
   */
  const adjustTimer = useCallback((durationSeconds: number) => {
    setTotalSeconds(durationSeconds);
    const newEnd = Date.now() + durationSeconds * 1000;
    endTimestampRef.current = newEnd;
    setRemaining(durationSeconds);
  }, []);

  // ── Fetch + load audio on mount ──
  useEffect(() => {
    let cancelled = false;

    async function loadAudio() {
      setAudioState('loading');

      const todayKey = ClockService.getLocalDateKey();
      const session = await SessionRepository.getSessionFor(todayKey, phase);

      if (cancelled) return;

      if (!session) {
        // No content — timer-only mode at fallback duration
        setAudioState('timer_only');
        TelemetryService.logEvent('audio_load_failed', {
          phase,
          error: 'no_content',
        });
        return;
      }

      setSessionData(session);

      if (session.isFallback) {
        TelemetryService.logEvent('fallback_used', {
          phase,
          fallbackDate: session.scheduledDate,
        });
      }

      const loaded = await AudioService.load(session.signedAudioUrl);

      if (cancelled) return;

      if (loaded) {
        setAudioState('loaded');
        // Adjust timer to match audio duration (only if not crash-resuming)
        if (!resuming) {
          adjustTimer(session.durationSeconds);
        }
        AudioService.play();
      } else {
        setAudioState('failed');
        TelemetryService.logEvent('audio_load_failed', {
          phase,
          error: 'load_timeout',
        });
      }
    }

    loadAudio();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Retry audio load (single attempt) ──
  const handleRetryAudio = useCallback(async () => {
    if (hasRetried.current || !sessionData) return;
    hasRetried.current = true;
    setAudioState('retrying');

    const loaded = await AudioService.load(sessionData.signedAudioUrl);

    if (loaded) {
      setAudioState('loaded');
      adjustTimer(sessionData.durationSeconds);
      AudioService.play();
    } else {
      setAudioState('timer_only');
    }
  }, [sessionData, adjustTimer]);

  // ── Cleanup audio on unmount ──
  useEffect(() => {
    return () => {
      AudioService.unload();
    };
  }, []);

  // ── For unlock phase: create active session timestamps ──
  useEffect(() => {
    if (phase === 'unlock' && !resuming) {
      const session = createSession(SESSION_DURATION);
      dispatch({ type: 'SET_ANIMATING' });
      setTimeout(() => {
        dispatch({
          type: 'START_SESSION',
          payload: {
            startTimestamp: session.startTimestamp,
            expectedEndTimestamp: session.expectedEndTimestamp,
            durationMinutes: SESSION_DURATION,
          },
        });
      }, 0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Entry animation sequence ──
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        Animated.timing(microTextOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 300),
    );

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

    tickRef.current = setInterval(() => {
      const r = getRemaining(endTimestampRef.current);
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
  }, [isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer completion ──
  const handleTimerComplete = useCallback(() => {
    if (isComplete) return;
    setIsComplete(true);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Stop audio
    AudioService.stop();

    // Dispatch appropriate completion action
    const durationMinutes = Math.ceil(totalSeconds / 60);
    if (phase === 'lock_in') {
      dispatch({
        type: 'COMPLETE_SESSION',
        payload: { durationMinutes },
      });
    } else {
      dispatch({
        type: 'COMPLETE_UNLOCK',
        payload: { durationMinutes },
      });
    }

    TelemetryService.logEvent('session_completed', {
      phase,
      hasAudio: audioState === 'loaded',
    });

    Animated.timing(completeTextOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(timerOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        navigation.replace('Home');
      });
    }, 1500);
  }, [isComplete, dispatch, phase, completeTextOpacity, timerOpacity, navigation, audioState, totalSeconds]);

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

      if (elapsed % 500 < 50) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (progress >= 1) {
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

    // Stop audio
    AudioService.stop();

    // Dispatch appropriate completion
    const durationMinutes = Math.ceil(totalSeconds / 60);
    if (phase === 'lock_in') {
      dispatch({
        type: 'COMPLETE_SESSION',
        payload: { durationMinutes },
      });
    } else {
      dispatch({
        type: 'COMPLETE_UNLOCK',
        payload: { durationMinutes },
      });
    }

    TelemetryService.logEvent('session_exited_early', {
      phase,
      elapsedSeconds: totalSeconds - remaining,
    });

    Animated.timing(timerOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.replace('Home');
    });
  }, [dispatch, phase, timerOpacity, navigation, totalSeconds, remaining]);

  // ── BackHandler: block Android back ──
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => handler.remove();
  }, []);

  // ── AppState: pause/resume audio + recalculate timer ──
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background') {
          AudioService.pause();
        } else if (nextState === 'active') {
          // Resume audio
          if (audioState === 'loaded') {
            AudioService.play();
          }

          // Recalculate timer from end timestamp
          const r = getRemaining(endTimestampRef.current);
          setRemaining(r);
          if (r <= 0) {
            handleTimerComplete();
          }
        }
      },
    );
    return () => subscription.remove();
  }, [handleTimerComplete, audioState]);

  // Cleanup hold interval on unmount
  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  const elapsed = totalSeconds - remaining;
  const phaseText = getPhaseTextForPhase(phase, elapsed, totalSeconds);

  // ── Audio status indicator ──
  const audioIndicator = (() => {
    switch (audioState) {
      case 'loading':
      case 'retrying':
        return 'Loading audio...';
      case 'failed':
        return null; // rendered separately with retry button
      case 'timer_only':
        return 'Audio unavailable — run the protocol anyway.';
      default:
        return null;
    }
  })();

  return (
    <View style={styles.container}>
      {/* Micro text */}
      <Animated.View style={[styles.centerContent, { opacity: microTextOpacity }]}>
        <Text style={styles.microText}>
          {getMicroText(phase)}
        </Text>
      </Animated.View>

      {/* Timer + Phase text */}
      <Animated.View style={[styles.centerContent, { opacity: timerOpacity }]}>
        {!isComplete ? (
          <>
            <Text style={styles.timer}>{formatTime(remaining)}</Text>
            <Text style={styles.phaseText}>{phaseText}</Text>

            {/* Audio status indicators */}
            {audioIndicator && (
              <Text style={styles.audioIndicator}>{audioIndicator}</Text>
            )}

            {/* Failed state with retry button */}
            {audioState === 'failed' && (
              <View style={styles.audioFailedContainer}>
                <Text style={styles.audioIndicator}>
                  Audio unavailable — run the protocol anyway.
                </Text>
                <TouchableOpacity onPress={handleRetryAudio} style={styles.retryButton}>
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Fallback indicator */}
            {sessionData?.isFallback && audioState === 'loaded' && (
              <Text style={styles.fallbackIndicator}>Using last published session</Text>
            )}
          </>
        ) : (
          <Animated.Text style={[styles.completeText, { opacity: completeTextOpacity }]}>
            {getCompletionText(phase)}
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
  audioIndicator: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
  audioFailedContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  retryText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  fallbackIndicator: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.5,
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
