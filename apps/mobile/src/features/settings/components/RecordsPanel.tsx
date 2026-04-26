/**
 * RecordsPanel — Lifetime stats from user_stats wrapped in a HUDPanel.
 * Read-only; no per-stat tap action. Subscribes to StatsService for
 * live updates so lifetime totals tick up after a session completes.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { UserStatsRow } from '@lockedin/shared-types';
import HUDPanel from '../../home/components/HUDPanel';
import { FontFamily } from '../../../design/typography';
import { StatsService } from '../../../services/StatsService';
import { SystemTokens } from '../../home/systemTokens';

interface Row {
  label: string;
  value: string;
}

const RecordsPanel: React.FC = () => {
  const [stats, setStats] = useState<UserStatsRow | null>(StatsService.getCached());

  useEffect(() => StatsService.subscribe(setStats), []);

  const rows: Row[] = [
    {
      label: 'Longest streak',
      value: `${(stats?.longest_streak_days ?? 0).toLocaleString()} days`,
    },
    {
      label: 'Total sessions',
      value: (stats?.total_completed_sessions ?? 0).toLocaleString(),
    },
    {
      label: 'Focus minutes',
      value: (stats?.total_focus_minutes ?? 0).toLocaleString(),
    },
    {
      label: 'Missions done',
      value: (stats?.total_missions_completed ?? 0).toLocaleString(),
    },
    {
      label: 'Perfect days',
      value: (stats?.total_perfect_days ?? 0).toLocaleString(),
    },
  ];

  return (
    <HUDPanel headerLabel="RECORDS">
      {rows.map((r, i) => (
        <View
          key={r.label}
          style={[styles.row, i < rows.length - 1 && styles.rowDivider]}
        >
          <Text style={styles.label}>{r.label}</Text>
          <Text style={styles.value}>{r.value}</Text>
        </View>
      ))}
    </HUDPanel>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: SystemTokens.divider,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: SystemTokens.textMuted,
  },
  value: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: SystemTokens.textPrimary,
    letterSpacing: -0.2,
  },
});

export default React.memo(RecordsPanel);
