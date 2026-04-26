/**
 * MissionHistoryPanel — Lifetime + season mission stats. Uses what's
 * already tracked: today's daily completion (provider state), season
 * XP (provider totalXP), lifetime totals (user_stats.total_perfect_days
 * + total_missions_completed). No new persistence layer required.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { UserStatsRow } from '@lockedin/shared-types';
import HUDPanel from '../../home/components/HUDPanel';
import StatBar from '../../home/components/StatBar';
import { FontFamily } from '../../../design/typography';
import { StatsService } from '../../../services/StatsService';
import { SystemTokens } from '../../home/systemTokens';

interface MissionHistoryPanelProps {
  /** Today's daily missions completed count. */
  completedToday: number;
  /** Today's daily missions total count. */
  totalToday: number;
  /** Season XP earned to date. */
  seasonXp: number;
}

const MissionHistoryPanel: React.FC<MissionHistoryPanelProps> = ({
  completedToday,
  totalToday,
  seasonXp,
}) => {
  const [stats, setStats] = useState<UserStatsRow | null>(StatsService.getCached());

  useEffect(() => StatsService.subscribe(setStats), []);

  const lifetimeMissions = stats?.total_missions_completed ?? 0;
  const perfectDays = stats?.total_perfect_days ?? 0;

  return (
    <HUDPanel headerLabel="HISTORY">
      <View style={styles.barWrap}>
        <StatBar
          label="TODAY"
          value={`${completedToday}/${totalToday}`}
          current={completedToday}
          max={Math.max(1, totalToday)}
          color={SystemTokens.cyan}
          labelWidth={48}
          valueWidth={36}
        />
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>SEASON XP</Text>
          <Text style={styles.statValue}>{seasonXp.toLocaleString()}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>PERFECT DAYS</Text>
          <Text style={styles.statValue}>{perfectDays}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>LIFETIME</Text>
          <Text style={styles.statValue}>{lifetimeMissions.toLocaleString()}</Text>
        </View>
      </View>
    </HUDPanel>
  );
};

const styles = StyleSheet.create({
  barWrap: {
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: SystemTokens.divider,
    alignItems: 'flex-start',
    gap: 4,
  },
  statLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 9,
    letterSpacing: 1,
    color: SystemTokens.textMuted,
  },
  statValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    color: SystemTokens.textPrimary,
    letterSpacing: -0.3,
  },
});

export default React.memo(MissionHistoryPanel);
