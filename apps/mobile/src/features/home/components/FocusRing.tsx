/**
 * FocusRing — HUD focus panel.
 *
 * Idle: reticle ring with daily-goal progress + an "ACTIVATE SESSION" button
 * wired into the duration picker via LockInContext.
 *
 * Active (a Lock In session is running, via ActiveSessionProvider): the ring
 * becomes a minimized live timer — countdown in the center, arc driven by
 * session progress — and the button becomes "Pause Protocol" (opens the break
 * picker) or "Resume" while on a break. Tapping the ring re-opens the full
 * timer page.
 */

import React, { useContext, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  G,
  Line,
} from 'react-native-svg';
import { FontFamily } from '../../../design/typography';
import HUDPanel from './HUDPanel';
import StatBar from './StatBar';
import { SystemTokens } from '../systemTokens';
import { LockInContext } from '../../../navigation/LockInContext';
import { BreakContext } from '../../../navigation/BreakContext';
import { useActiveSession, useActiveSessionActions } from '../state/ActiveSessionProvider';

interface FocusRingProps {
  focused: number;
  goal: number;
  streakAtRisk?: boolean;
  onActivate?: () => void;
  /** Re-open the full timer page when a session is active. */
  onOpenTimer?: () => void;
}

const SIZE = 150;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const FocusRing: React.FC<FocusRingProps> = ({
  focused,
  goal,
  streakAtRisk,
  onActivate,
  onOpenTimer,
}) => {
  const onLockInPress = useContext(LockInContext);
  const { openBreakPicker } = useContext(BreakContext);
  const session = useActiveSession();
  const { resumeFromBreak } = useActiveSessionActions();
  const handleActivate = onActivate ?? onLockInPress;

  const active = session.isActive;
  const paused = active && session.paused;

  // Active: progress through the focus block. Idle: progress to daily goal.
  const progress = active
    ? (session.totalSeconds > 0
        ? Math.min(1, (session.totalSeconds - session.remaining) / session.totalSeconds)
        : 0)
    : Math.min(1, goal > 0 ? focused / goal : 0);

  const dashOffset = useRef(new Animated.Value(CIRCUMFERENCE)).current;

  useEffect(() => {
    Animated.timing(dashOffset, {
      toValue: CIRCUMFERENCE * (1 - progress),
      duration: active ? 400 : 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, active, dashOffset]);

  // Idle breathing on the empty ring (focused === 0, no active session)
  const breathe = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (active || focused !== 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0.6,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, focused, breathe]);

  const isAtRisk = !!streakAtRisk;
  // Active uses cyan while on break (status), blue otherwise; idle keeps the
  // red at-risk treatment.
  const ringColor = paused
    ? SystemTokens.cyan
    : active
      ? SystemTokens.glowAccent
      : isAtRisk
        ? SystemTokens.red
        : SystemTokens.glowAccent;
  const ringColorLight = paused ? '#7BE3FF' : isAtRisk && !active ? '#FF6B81' : SystemTokens.cyan;

  const displaySeconds = paused ? session.breakRemaining : session.remaining;

  const renderRing = (children: React.ReactNode) => (
    <Animated.View style={[styles.ringWrap, !active && focused === 0 && { opacity: breathe }]}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ringColor} />
            <Stop offset="1" stopColor={ringColorLight} />
          </SvgGradient>
        </Defs>

        {/* Track */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE}
          fill="none"
        />

        {/* Reticle ticks at 12 / 3 / 6 / 9 */}
        <G stroke={ringColor} strokeWidth={1} opacity={0.45}>
          <Line x1={SIZE / 2} y1={2} x2={SIZE / 2} y2={8} />
          <Line x1={SIZE - 8} y1={SIZE / 2} x2={SIZE - 2} y2={SIZE / 2} />
          <Line x1={SIZE / 2} y1={SIZE - 8} x2={SIZE / 2} y2={SIZE - 2} />
          <Line x1={2} y1={SIZE / 2} x2={8} y2={SIZE / 2} />
        </G>

        {/* Progress arc (rotated -90 so it starts at top) */}
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="url(#ringGrad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>

      <View style={styles.ringCenter} pointerEvents="none">
        {children}
      </View>
    </Animated.View>
  );

  // ── Active session: minimized live timer ──
  if (active) {
    return (
      <HUDPanel
        headerLabel="FOCUS"
        headerRight={paused ? 'ON BREAK' : 'LOCKED IN'}
        accentColor={ringColor}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={onOpenTimer}>
          {renderRing(
            <>
              {paused && <Text style={[styles.activeTag, { color: ringColor }]}>ON BREAK</Text>}
              <Text style={[styles.timerNumeric, { color: paused ? ringColor : SystemTokens.textPrimary }]}>
                {formatTime(displaySeconds)}
              </Text>
              <Text style={styles.label}>{paused ? 'resumes soon' : 'remaining'}</Text>
            </>,
          )}
        </TouchableOpacity>

        {paused ? (
          <TouchableOpacity style={styles.resumeBtn} onPress={resumeFromBreak} activeOpacity={0.85}>
            <Text style={styles.resumeText}>▶  RESUME</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.pauseBtn} onPress={openBreakPicker} activeOpacity={0.85}>
            <Text style={styles.pauseText}>❚❚  PAUSE PROTOCOL</Text>
          </TouchableOpacity>
        )}
      </HUDPanel>
    );
  }

  // ── Idle: daily-goal ring ──
  return (
    <HUDPanel
      headerLabel="FOCUS"
      headerRight={`${focused}/${goal} MIN`}
      accentColor={ringColor}
    >
      {renderRing(
        <>
          <Text style={styles.numeric}>{focused}</Text>
          <Text style={styles.unit}>min</Text>
          <Text style={styles.label}>focused today</Text>
        </>,
      )}

      <View style={styles.barWrap}>
        <StatBar
          label="GOAL"
          value={`${focused}/${goal}`}
          current={focused}
          max={goal}
          color={ringColor}
          labelWidth={36}
          valueWidth={48}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.activateBtn,
          isAtRisk && {
            backgroundColor: 'rgba(255,71,87,0.12)',
            borderColor: 'rgba(255,71,87,0.4)',
          },
        ]}
        onPress={handleActivate}
        activeOpacity={0.85}
      >
        <Text style={[styles.activateText, isAtRisk && { color: SystemTokens.red }]}>
          ⟐  ACTIVATE SESSION
        </Text>
      </TouchableOpacity>
    </HUDPanel>
  );
};

const styles = StyleSheet.create({
  ringWrap: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
    marginVertical: 6,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeric: {
    fontFamily: FontFamily.headingBold,
    fontSize: 44,
    color: SystemTokens.textPrimary,
    letterSpacing: -1,
    lineHeight: 48,
  },
  timerNumeric: {
    fontFamily: FontFamily.headingBold,
    fontSize: 38,
    color: SystemTokens.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    lineHeight: 44,
  },
  activeTag: {
    fontFamily: FontFamily.headingBold,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 2,
  },
  unit: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: SystemTokens.textSecondary,
    marginTop: -2,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: SystemTokens.textMuted,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  barWrap: {
    marginTop: 10,
    marginBottom: 12,
  },
  activateBtn: {
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.35)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 2,
    color: SystemTokens.glowAccent,
  },
  pauseBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(255,71,87,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.4)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 2,
    color: SystemTokens.red,
  },
  resumeBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(58,102,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.45)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 2,
    color: SystemTokens.glowAccent,
  },
});

export default React.memo(FocusRing);
