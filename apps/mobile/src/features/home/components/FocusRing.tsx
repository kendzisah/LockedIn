/**
 * FocusRing — HUD focus panel. Renders a reticle-style ring with
 * gradient-stroke progress arc, a daily-goal StatBar, and an
 * "ACTIVATE SESSION" button wired into the existing duration picker
 * via LockInContext.
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

interface FocusRingProps {
  focused: number;
  goal: number;
  streakAtRisk?: boolean;
  onActivate?: () => void;
}

const SIZE = 150;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const FocusRing: React.FC<FocusRingProps> = ({
  focused,
  goal,
  streakAtRisk,
  onActivate,
}) => {
  const onLockInPress = useContext(LockInContext);
  const handleActivate = onActivate ?? onLockInPress;

  const progress = Math.min(1, goal > 0 ? focused / goal : 0);
  const dashOffset = useRef(new Animated.Value(CIRCUMFERENCE)).current;

  useEffect(() => {
    Animated.timing(dashOffset, {
      toValue: CIRCUMFERENCE * (1 - progress),
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, dashOffset]);

  // Idle breathing on the empty ring (focused === 0)
  const breathe = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (focused !== 0) return;
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
  }, [focused, breathe]);

  const isAtRisk = !!streakAtRisk;
  const ringColor = isAtRisk ? SystemTokens.red : SystemTokens.glowAccent;
  const ringColorLight = isAtRisk ? '#FF6B81' : SystemTokens.cyan;

  return (
    <HUDPanel
      headerLabel="FOCUS"
      headerRight={`${focused}/${goal} MIN`}
      accentColor={ringColor}
    >
      <Animated.View style={[styles.ringWrap, focused === 0 && { opacity: breathe }]}>
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
          <Text style={styles.numeric}>{focused}</Text>
          <Text style={styles.unit}>min</Text>
          <Text style={styles.label}>focused today</Text>
        </View>
      </Animated.View>

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
});

export default React.memo(FocusRing);
