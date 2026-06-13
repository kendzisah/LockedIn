/**
 * ExecutionBlockScreen — full-screen view of an active Lock In session.
 *
 * The timer itself lives in ActiveSessionProvider; this screen is a view over
 * it. The user is no longer trapped here — "Minimize" returns to the app with
 * the session still running (Home shows a minimized timer), "Take a Break"
 * pauses the focus countdown, and hold-to-unlock ends the session early.
 */

import React, { useCallback, useContext, useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { useActiveSession, useActiveSessionActions } from './state/ActiveSessionProvider';
import { BreakContext } from '../../navigation/BreakContext';
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';
import { SystemTokens } from './systemTokens';

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

const ExecutionBlockScreen: React.FC<Props> = ({ navigation }) => {
  const { remaining, paused, breakRemaining, totalSeconds } = useActiveSession();
  const { endSessionEarly, resumeFromBreak } = useActiveSessionActions();
  const { openBreakPicker } = useContext(BreakContext);
  useKeepAwake();

  const timerOpacity = useRef(new Animated.Value(0)).current;

  // Minimize: leave the timer page but keep the session running in the provider.
  const minimize = useCallback(() => {
    navigation.navigate('Tabs', { screen: 'HomeTab' });
  }, [navigation]);

  // Fade the timer in on mount.
  useEffect(() => {
    Animated.timing(timerOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [timerOpacity]);

  // Android back = minimize (never ends the session).
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      minimize();
      return true;
    });
    return () => handler.remove();
  }, [minimize]);

  // ── Hold-to-unlock (end session early) ──
  const [holdProgress, setHoldProgress] = React.useState(0);
  const holdStartRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdRingScale = useRef(new Animated.Value(0)).current;

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
        endSessionEarly();
      }
    }, 50);
  }, [holdRingScale, endSessionEarly]);

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

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  const elapsed = totalSeconds - remaining;
  const phaseText = paused ? 'On break — resumes automatically.' : getPhaseText(elapsed, totalSeconds);
  const displaySeconds = paused ? breakRemaining : remaining;

  return (
    <View style={styles.container}>
      {/* Minimize */}
      <TouchableOpacity
        style={styles.minimizeBtn}
        onPress={minimize}
        hitSlop={12}
        activeOpacity={0.8}
        accessibilityLabel="Minimize timer"
      >
        <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
        <Text style={styles.minimizeText}>MINIMIZE</Text>
      </TouchableOpacity>

      <Animated.View style={[styles.centerContent, { opacity: timerOpacity }]}>
        {paused && <Text style={styles.breakLabel}>ON BREAK</Text>}
        <Text style={[styles.timer, paused && styles.timerPaused]}>
          {formatTime(displaySeconds)}
        </Text>
        <Text style={styles.phaseText}>{phaseText}</Text>
      </Animated.View>

      <View style={styles.actions}>
        {paused ? (
          <TouchableOpacity
            style={[styles.breakBtn, styles.resumeBtn]}
            onPress={resumeFromBreak}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={14} color={SystemTokens.glowAccent} />
            <Text style={styles.breakText}>RESUME</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.breakBtn}
            onPress={openBreakPicker}
            activeOpacity={0.85}
          >
            <Ionicons name="pause" size={14} color={SystemTokens.cyan} />
            <Text style={[styles.breakText, { color: SystemTokens.cyan }]}>TAKE A BREAK</Text>
          </TouchableOpacity>
        )}

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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lockInBackground,
  },
  minimizeBtn: {
    position: 'absolute',
    top: 64,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
  },
  minimizeText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.textMuted,
  },
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  breakLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 3,
    color: SystemTokens.cyan,
    marginBottom: 12,
  },
  timer: {
    fontFamily: FontFamily.headingBold,
    fontSize: 72,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginBottom: 24,
  },
  timerPaused: {
    color: SystemTokens.cyan,
  },
  phaseText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 20,
  },
  breakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,194,255,0.3)',
  },
  resumeBtn: {
    borderColor: 'rgba(58,102,255,0.45)',
    backgroundColor: 'rgba(58,102,255,0.14)',
  },
  breakText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: SystemTokens.glowAccent,
  },
  holdSection: {
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
