/**
 * FocusRing — Circular progress ring using pure RN Views (no SVG dependency).
 * Glassmorphic inner surface with gradient-simulated ring.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

interface FocusRingProps {
  focused: number;
  goal: number;
  streakAtRisk?: boolean;
}

const SIZE = 210;
const STROKE = 8;
const INNER_SIZE = SIZE - STROKE * 2 - 20;

const FocusRing: React.FC<FocusRingProps> = ({ focused, goal, streakAtRisk }) => {
  const progress = Math.min(1, focused / goal);
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress, rotation]);

  const fillColor = streakAtRisk ? Colors.danger : Colors.primary;
  const accentColor = streakAtRisk ? '#FF6B81' : Colors.accent;

  return (
    <View style={styles.container}>
      <View style={[styles.glow, streakAtRisk && { backgroundColor: 'rgba(255,71,87,0.06)' }]} />

      <View style={styles.ringOuter}>
        {/* Track ring */}
        <View style={styles.trackRing} />

        {/* Progress segments — 36 segments for smooth appearance */}
        {Array.from({ length: 36 }).map((_, i) => {
          const segmentAngle = (i / 36) * 360;
          const segmentProgress = i / 36;
          const isActive = segmentProgress < progress;

          return (
            <View
              key={i}
              style={[
                styles.segment,
                {
                  transform: [
                    { rotate: `${segmentAngle}deg` },
                    { translateY: -(SIZE / 2 - STROKE / 2) },
                  ],
                  backgroundColor: isActive ? fillColor : 'transparent',
                  shadowColor: isActive ? fillColor : 'transparent',
                  shadowOpacity: isActive ? 0.6 : 0,
                  shadowRadius: isActive ? 4 : 0,
                },
              ]}
            />
          );
        })}

        {/* Glass inner circle */}
        <View style={styles.innerGlass}>
          <Text style={[styles.focusedNum, streakAtRisk && { color: Colors.danger }]}>
            {focused}
          </Text>
          <Text style={styles.focusedUnit}>min</Text>
          <Text style={styles.focusedLabel}>focused today</Text>
        </View>
      </View>

      <Text style={styles.goalLine}>
        Daily goal:{' '}
        <Text style={{ color: accentColor }}>{focused}</Text>
        <Text style={{ color: Colors.textMuted }}> / </Text>
        <Text style={{ color: accentColor }}>{goal}</Text>
        <Text style={{ color: Colors.textMuted }}> min</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 12,
  },
  glow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(58,102,255,0.05)',
    top: -15,
  },
  ringOuter: {
    width: SIZE,
    height: SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackRing: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: STROKE,
    borderColor: 'rgba(44,52,64,0.6)',
  },
  segment: {
    position: 'absolute',
    width: STROKE,
    height: STROKE + 2,
    borderRadius: STROKE / 2,
    left: SIZE / 2 - STROKE / 2,
    top: SIZE / 2 - (STROKE + 2) / 2,
    shadowOffset: { width: 0, height: 0 },
  },
  innerGlass: {
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: INNER_SIZE / 2,
    backgroundColor: 'rgba(21,26,33,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusedNum: {
    fontFamily: FontFamily.headingBold,
    fontSize: 40,
    color: Colors.textPrimary,
    letterSpacing: -1.5,
  },
  focusedUnit: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  focusedLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  goalLine: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 14,
  },
});

export default React.memo(FocusRing);
