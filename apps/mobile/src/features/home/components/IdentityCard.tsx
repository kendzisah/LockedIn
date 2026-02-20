/**
 * IdentityCard — Dynamic identity reinforcement message.
 *
 * Single card with subtle accent glow border.
 * Deterministic copy states based on streak.
 * First-week cap on variant diversity.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '../state/SessionProvider';
import {
  computeCurrentDay,
  getIdentityMessage,
} from '../engine/SessionEngine';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const IdentityCard: React.FC = () => {
  const { state } = useSession();

  const currentDay = useMemo(
    () => computeCurrentDay(state.startDayKey),
    [state.startDayKey],
  );

  const message = useMemo(
    () =>
      getIdentityMessage(
        state.consecutiveStreak,
        state.longestStreak,
        state.lastSessionDayKey,
        state.completedDayKeys,
        currentDay,
      ),
    [
      state.consecutiveStreak,
      state.longestStreak,
      state.lastSessionDayKey,
      state.completedDayKeys,
      currentDay,
    ],
  );

  return (
    <View style={styles.card}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: 'rgba(58, 102, 255, 0.10)', // accent at 10% opacity
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(21, 26, 33, 0.6)', // backgroundSecondary at 60%
  },
  message: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 20,
  },
});

export default React.memo(IdentityCard);
