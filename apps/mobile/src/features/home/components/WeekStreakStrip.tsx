/**
 * WeekStreakStrip — Compact streak indicator that sits directly beneath
 * DayDots on HomeTab. Shows the current streak number with the existing
 * flame Lottie tinted to the active streak tier color.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { useSession } from '../state/SessionProvider';
import {
  getStreakTierInfo,
  getFlameColorFilters,
} from '../../../design/streakTiers';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const WeekStreakStrip: React.FC = () => {
  const { state } = useSession();
  const streak = state.consecutiveStreak;
  const tier = useMemo(() => getStreakTierInfo(streak), [streak]);
  const flameFilters = useMemo(
    () => getFlameColorFilters(tier.color, tier.colorLight),
    [tier.color, tier.colorLight],
  );

  return (
    <View
      style={[
        styles.strip,
        streak > 0 && {
          backgroundColor: `${tier.color}10`,
          borderColor: `${tier.color}30`,
        },
      ]}
    >
      <View style={styles.flameWrap}>
        <LottieView
          source={require('../../../../assets/lottie/fire.json')}
          autoPlay
          loop
          style={styles.flame}
          colorFilters={streak > 0 ? flameFilters : undefined}
        />
      </View>
      <Text
        style={[
          styles.value,
          streak > 0 && { color: tier.color },
        ]}
      >
        {streak}
      </Text>
      <Text style={styles.label}>
        {streak === 1 ? 'DAY STREAK' : 'DAY STREAK'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 16,
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(21,26,33,0.4)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  flameWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flame: {
    width: 28,
    height: 28,
  },
  value: {
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    color: Colors.textMuted,
    letterSpacing: -0.3,
  },
  label: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
  },
});

export default WeekStreakStrip;
