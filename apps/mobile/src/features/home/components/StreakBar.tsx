/**
 * StreakBar — Glassmorphic streak progress card with animated fill.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { getStreakTierInfo } from '../../../design/streakTiers';

interface StreakBarProps {
  streak: number;
}

const StreakBar: React.FC<StreakBarProps> = ({ streak }) => {
  const tierInfo = useMemo(() => getStreakTierInfo(streak), [streak]);
  const barWidth = useRef(new Animated.Value(0)).current;
  const hasStreak = streak > 0;

  useEffect(() => {
    Animated.timing(barWidth, {
      toValue: tierInfo.progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [tierInfo.progress, barWidth]);

  const barInterpolated = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const targetLabel = tierInfo.next
    ? `${tierInfo.next.label} Streak`
    : tierInfo.current
      ? (tierInfo.current.threshold >= 365 ? 'Legendary' : `${tierInfo.current.label} Streak`)
      : '3 Day Streak';

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <View style={styles.dayBadge}>
          <LottieView
            source={require('../../../../assets/lottie/dark-fire.json')}
            autoPlay={hasStreak}
            loop={hasStreak}
            progress={hasStreak ? undefined : 0}
            style={styles.fireIcon}
          />
          <Text style={[styles.dayCount, { color: tierInfo.color }]}>{streak}</Text>
        </View>
        <Text style={styles.target}>{targetLabel}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { width: barInterpolated, backgroundColor: tierInfo.color },
          ]}
        />
        {/* Glow overlay on fill */}
        <Animated.View
          style={[
            styles.fillGlow,
            { width: barInterpolated, shadowColor: tierInfo.color },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    padding: 14,
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fireIcon: {
    width: 18,
    height: 18,
  },
  dayCount: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
  },
  target: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  track: {
    height: 6,
    backgroundColor: 'rgba(44,52,64,0.5)',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  fillGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
});

export default React.memo(StreakBar);
