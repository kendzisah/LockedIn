/**
 * CompactMissions — Quest-log HUD panel. One row per mission with
 * a stat-color left accent, status icon, name, description, stat
 * pills, and XP value. Bottom row shows the +50 XP "complete all"
 * bonus. The whole panel is the touch target (opens MissionsTab).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Stat } from '@lockedin/shared-types';
import { useMissions } from '../../missions/MissionsProvider';
import { FontFamily } from '../../../design/typography';
import HUDPanel from './HUDPanel';
import { STAT_COLORS, STAT_LABELS, SystemTokens } from '../systemTokens';

interface CompactMissionsProps {
  onPress: () => void;
}

const CompactMissions: React.FC<CompactMissionsProps> = ({ onPress }) => {
  const { missions, completedCount } = useMissions();
  const allDone = missions.length > 0 && completedCount === missions.length;

  return (
    <HUDPanel
      headerLabel="MISSIONS"
      headerRight={`${completedCount}/${missions.length}`}
      onPress={onPress}
      contentStyle={styles.content}
    >
      {missions.slice(0, 3).map((m) => {
        const primaryStat: Stat | undefined = m.stats?.[0];
        const accent = primaryStat ? STAT_COLORS[primaryStat] : SystemTokens.glowAccent;
        return (
          <View key={m.id} style={[styles.row, { borderLeftColor: accent }]}>
            <View style={styles.rowHead}>
              <View style={styles.statusIcon}>
                {m.completed ? (
                  <View style={[styles.iconFilled, { backgroundColor: SystemTokens.green }]}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={styles.iconHollow} />
                )}
              </View>
              <Text
                style={[
                  styles.title,
                  m.completed && styles.titleDone,
                ]}
                numberOfLines={1}
              >
                {m.title}
              </Text>
            </View>

            <Text style={styles.desc} numberOfLines={2}>
              {m.description}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.pillRow}>
                {(m.stats ?? []).slice(0, 2).map((s) => (
                  <View
                    key={s}
                    style={[
                      styles.pill,
                      { backgroundColor: `${STAT_COLORS[s]}1A`, borderColor: `${STAT_COLORS[s]}55` },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: STAT_COLORS[s] }]}>
                      +{STAT_LABELS[s]}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.xp, m.completed && styles.xpDone]}>+{m.xp} XP</Text>
            </View>
          </View>
        );
      })}

      <View style={styles.bonusRow}>
        <Text
          style={[
            styles.bonusText,
            allDone && {
              textShadowColor: SystemTokens.gold,
              textShadowRadius: 8,
              textShadowOffset: { width: 0, height: 0 },
            },
          ]}
        >
          {allDone ? '✦ ALL MISSIONS CLEAR  —  +50 XP' : 'COMPLETE ALL  —  +50 XP BONUS'}
        </Text>
      </View>
    </HUDPanel>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 8,
  },
  row: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    paddingVertical: 8,
    paddingRight: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIcon: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHollow: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.2,
    borderColor: SystemTokens.textMuted,
  },
  iconFilled: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: SystemTokens.textPrimary,
    letterSpacing: -0.1,
  },
  titleDone: {
    color: SystemTokens.textMuted,
    textDecorationLine: 'line-through',
  },
  desc: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: SystemTokens.textMuted,
    marginTop: 3,
    marginLeft: 24,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginLeft: 24,
    gap: 8,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  xp: {
    fontFamily: FontFamily.headingBold,
    fontSize: 11,
    color: SystemTokens.cyan,
    letterSpacing: 0.6,
  },
  xpDone: {
    color: SystemTokens.textMuted,
  },
  bonusRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SystemTokens.divider,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  bonusText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: SystemTokens.gold,
  },
});

export default React.memo(CompactMissions);
