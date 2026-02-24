/**
 * StatsRow — 3-column: Current Streak | Total Minutes | % Commitment.
 *
 * Uses completion-based computeCommitmentPercent(maxCompletedDay, programStartDate).
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '../state/SessionProvider';
import { computeCommitmentPercent } from '../engine/SessionEngine';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const StatsRow: React.FC = () => {
  const { state } = useSession();

  const commitment = useMemo(
    () =>
      computeCommitmentPercent(
        state.maxCompletedDay,
        state.programStartDate,
        state.lastLockInCompletedDate,
      ),
    [state.maxCompletedDay, state.programStartDate, state.lastLockInCompletedDate],
  );

  return (
    <View style={styles.container}>
      <StatColumn label="Streak" value={`${state.consecutiveStreak}`} />
      <View style={styles.divider} />
      <StatColumn label="Minutes" value={`${state.lifetimeTotalMinutes}`} />
      <View style={styles.divider} />
      <StatColumn label="Commitment" value={`${commitment}%`} />
    </View>
  );
};

interface StatColumnProps {
  label: string;
  value: string;
}

const StatColumn: React.FC<StatColumnProps> = ({ label, value }) => (
  <View style={styles.column}>
    <Text style={styles.value}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.surface,
    opacity: 0.5,
  },
});

export default React.memo(StatsRow);
