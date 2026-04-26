/**
 * SystemStatsCard — Character-sheet panel for the Profile screen.
 *
 * OVR + rank pill in the rank's color, followed by 5 tappable stat
 * rows using the home <StatBar> primitive. Tapping a row opens
 * StatDetailSheet with growth sources + sample missions.
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Stat, UserStatsRow } from '@lockedin/shared-types';
import HUDPanel from '../../home/components/HUDPanel';
import StatBar from '../../home/components/StatBar';
import StatDetailSheet from './StatDetailSheet';
import { FontFamily } from '../../../design/typography';
import { StatsService } from '../../../services/StatsService';
import { RankService } from '../../../services/RankService';
import { STAT_COLORS, STAT_LABELS, SystemTokens } from '../../home/systemTokens';

const STAT_ROWS: { key: Stat; label: string }[] = [
  { key: 'discipline',  label: STAT_LABELS.discipline  },
  { key: 'focus',       label: STAT_LABELS.focus       },
  { key: 'execution',   label: STAT_LABELS.execution   },
  { key: 'consistency', label: STAT_LABELS.consistency },
  { key: 'social',      label: STAT_LABELS.social      },
];

const SystemStatsCard: React.FC = () => {
  const [stats, setStats] = useState<UserStatsRow | null>(StatsService.getCached());
  const [openStat, setOpenStat] = useState<Stat | null>(null);

  useEffect(() => {
    void StatsService.refresh();
    return StatsService.subscribe(setStats);
  }, []);

  const ovr = stats?.ovr ?? 1;
  const totalXp = stats?.total_xp ?? 0;
  const streakDays = stats?.current_streak_days ?? 0;
  const rank = RankService.rankFromStreak(streakDays);

  return (
    <>
      <HUDPanel
        headerLabel="SYSTEM STATS"
        headerRight={`${totalXp.toLocaleString()} XP`}
        accentColor={rank.color}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.ovrLabel}>OVR</Text>
            <Text
              style={[
                styles.ovrValue,
                {
                  textShadowColor: rank.color,
                  textShadowRadius: 8,
                  textShadowOffset: { width: 0, height: 0 },
                },
              ]}
            >
              {ovr}
            </Text>
          </View>
          <View
            style={[
              styles.rankPill,
              {
                backgroundColor: `${rank.color}1A`,
                borderColor: `${rank.color}55`,
                shadowColor: rank.color,
              },
            ]}
          >
            <Text style={[styles.rankPillText, { color: rank.color }]}>
              {rank.name}
            </Text>
          </View>
        </View>

        <View style={styles.statBlock}>
          {STAT_ROWS.map((row, idx) => {
            const value = stats?.[row.key] ?? 1;
            return (
              <TouchableOpacity
                key={row.key}
                style={styles.statRowWrap}
                onPress={() => setOpenStat(row.key)}
                activeOpacity={0.85}
              >
                <StatBar
                  label={row.label}
                  value={value}
                  current={value}
                  max={99}
                  color={STAT_COLORS[row.key]}
                  delay={idx * 80}
                  height={20}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.tapHint}>Tap any stat for breakdown</Text>
      </HUDPanel>

      <StatDetailSheet
        visible={openStat !== null}
        stat={openStat}
        currentValue={openStat ? (stats?.[openStat] ?? 1) : 0}
        onClose={() => setOpenStat(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  ovrLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: SystemTokens.textMuted,
  },
  ovrValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 44,
    lineHeight: 48,
    color: SystemTokens.textPrimary,
  },
  rankPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1.5,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  rankPillText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 14,
    letterSpacing: 1.6,
  },
  statBlock: {
    gap: 8,
  },
  statRowWrap: {
    paddingVertical: 4,
  },
  tapHint: {
    marginTop: 12,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: SystemTokens.textMuted,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
});

export default SystemStatsCard;
