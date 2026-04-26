/**
 * StatGrowthPanel — Aggregates `mission.stats[]` across today's daily
 * missions and shows which stats today's set targets. Also surfaces the
 * user's lowest current stat as a "weakest stat" callout so they know
 * where to invest next.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Stat, UserStatsRow } from '@lockedin/shared-types';
import type { Mission } from '../MissionEngine';
import HUDPanel from '../../home/components/HUDPanel';
import { FontFamily } from '../../../design/typography';
import { StatsService } from '../../../services/StatsService';
import { STAT_COLORS, STAT_LABELS, SystemTokens } from '../../home/systemTokens';

const STAT_FULL_LABEL: Record<Stat, string> = {
  discipline:  'Discipline',
  focus:       'Focus',
  execution:   'Execution',
  consistency: 'Consistency',
  social:      'Social',
};

interface StatGrowthPanelProps {
  missions: Mission[];
}

const StatGrowthPanel: React.FC<StatGrowthPanelProps> = ({ missions }) => {
  const [stats, setStats] = useState<UserStatsRow | null>(StatsService.getCached());

  useEffect(() => StatsService.subscribe(setStats), []);

  const counts = useMemo(() => {
    const map = new Map<Stat, number>();
    for (const m of missions) {
      for (const s of m.stats ?? []) {
        map.set(s, (map.get(s) ?? 0) + 1);
      }
    }
    return map;
  }, [missions]);

  const weakestStat: Stat | null = useMemo(() => {
    if (!stats) return null;
    const order: Stat[] = ['discipline', 'focus', 'execution', 'consistency', 'social'];
    let lowest: Stat = 'discipline';
    let lowestVal = stats.discipline ?? 1;
    for (const s of order) {
      const v = stats[s] ?? 1;
      if (v < lowestVal) {
        lowest = s;
        lowestVal = v;
      }
    }
    return lowest;
  }, [stats]);

  const orderedStats: Stat[] = ['discipline', 'focus', 'execution', 'consistency', 'social'];

  return (
    <HUDPanel headerLabel="STAT GROWTH">
      <Text style={styles.intro}>Today&apos;s missions target:</Text>
      <View style={styles.grid}>
        {orderedStats.map((s) => {
          const count = counts.get(s) ?? 0;
          const active = count > 0;
          return (
            <View
              key={s}
              style={[
                styles.cell,
                active && {
                  backgroundColor: `${STAT_COLORS[s]}14`,
                  borderColor: `${STAT_COLORS[s]}44`,
                },
              ]}
            >
              <Text
                style={[
                  styles.cellLabel,
                  { color: active ? STAT_COLORS[s] : SystemTokens.textMuted },
                ]}
              >
                +{STAT_LABELS[s]}
              </Text>
              <Text
                style={[
                  styles.cellCount,
                  { color: active ? SystemTokens.textPrimary : SystemTokens.textMuted },
                ]}
              >
                {count}
              </Text>
            </View>
          );
        })}
      </View>

      {weakestStat && (
        <View
          style={[
            styles.weakestRow,
            { borderColor: `${STAT_COLORS[weakestStat]}55` },
          ]}
        >
          <Text style={styles.weakestLabel}>WEAKEST STAT</Text>
          <Text
            style={[
              styles.weakestValue,
              { color: STAT_COLORS[weakestStat] },
            ]}
          >
            {STAT_FULL_LABEL[weakestStat].toUpperCase()}
          </Text>
          <Text style={styles.weakestHint}>
            {(stats?.[weakestStat] ?? 1).toString().padStart(2, '0')} — focus missions in this
            stat to grow it
          </Text>
        </View>
      )}
    </HUDPanel>
  );
};

const styles = StyleSheet.create({
  intro: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: SystemTokens.textMuted,
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cell: {
    minWidth: 64,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: SystemTokens.divider,
    alignItems: 'center',
    gap: 2,
  },
  cellLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  cellCount: {
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
    letterSpacing: -0.3,
  },
  weakestRow: {
    marginTop: 12,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  weakestLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: SystemTokens.textMuted,
  },
  weakestValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 14,
    letterSpacing: 1,
    marginTop: 2,
  },
  weakestHint: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: SystemTokens.textMuted,
    marginTop: 4,
    letterSpacing: 0.3,
  },
});

export default React.memo(StatGrowthPanel);
