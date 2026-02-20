/**
 * ProgressBlock — Compact block with Day X/90 + progress bar + streak badge + dynamic subtext.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../state/SessionProvider';
import {
  computeCurrentDay,
  getProgressSubtext,
} from '../engine/SessionEngine';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const ProgressBlock: React.FC = () => {
  const { state } = useSession();

  const currentDay = useMemo(
    () => computeCurrentDay(state.startDayKey),
    [state.startDayKey],
  );

  const progressRatio = currentDay / 90;

  const subtext = useMemo(
    () => getProgressSubtext(state.consecutiveStreak, state.lastSessionDayKey),
    [state.consecutiveStreak, state.lastSessionDayKey],
  );

  // Animate bar width
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barWidth, {
      toValue: progressRatio,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progressRatio, barWidth]);

  const barWidthInterpolated = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Top row: Day X of 90 + Streak badge */}
      <View style={styles.topRow}>
        <Text style={styles.dayLabel}>
          Day {state.startDayKey ? currentDay : '—'} of 90
        </Text>
        {state.consecutiveStreak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>
              🔥 {state.consecutiveStreak}
            </Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { width: barWidthInterpolated },
          ]}
        />
      </View>

      {/* Dynamic subtext */}
      <Text style={styles.subtext}>{subtext}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dayLabel: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 0.2,
  },
  barTrack: {
    height: 3,
    backgroundColor: Colors.surface,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 1.5,
  },
  subtext: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
});

export default React.memo(ProgressBlock);
