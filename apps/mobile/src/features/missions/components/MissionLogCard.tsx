/**
 * MissionLogCard — HUD-styled quest log row used on the Missions tab.
 * Richer than the home CompactMissions row: shows full description and
 * is independently tappable to mark complete (with haptic).
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { Stat } from '@lockedin/shared-types';
import type { Mission } from '../MissionEngine';
import { FontFamily } from '../../../design/typography';
import { STAT_COLORS, STAT_LABELS, SystemTokens } from '../../home/systemTokens';

interface MissionLogCardProps {
  mission: Mission;
  onComplete: (missionId: string) => void;
}

const MissionLogCard: React.FC<MissionLogCardProps> = ({ mission, onComplete }) => {
  const primaryStat: Stat | undefined = mission.stats?.[0];
  const accent = primaryStat ? STAT_COLORS[primaryStat] : SystemTokens.glowAccent;

  const handlePress = () => {
    if (mission.completed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(mission.id);
  };

  return (
    <TouchableOpacity
      style={[styles.row, { borderLeftColor: accent }, mission.completed && styles.rowDone]}
      onPress={handlePress}
      activeOpacity={mission.completed ? 1 : 0.85}
      disabled={mission.completed}
    >
      <View style={styles.head}>
        <View style={styles.statusIcon}>
          {mission.completed ? (
            <View style={[styles.iconFilled, { backgroundColor: SystemTokens.green }]}>
              <Ionicons name="checkmark" size={11} color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.iconHollow} />
          )}
        </View>
        <Text style={[styles.title, mission.completed && styles.titleDone]} numberOfLines={2}>
          {mission.title}
        </Text>
      </View>

      <Text style={[styles.desc, mission.completed && styles.descDone]}>
        {mission.description}
      </Text>

      {mission.timeGate && (
        <Text style={styles.timeGate}>⏱  {mission.timeGate}</Text>
      )}

      <View style={styles.metaRow}>
        <View style={styles.pillRow}>
          {(mission.stats ?? []).slice(0, 2).map((s) => (
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
        <Text style={[styles.xp, mission.completed && styles.xpDone]}>+{mission.xp} XP</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    paddingVertical: 10,
    paddingRight: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rowDone: {
    backgroundColor: 'rgba(0,214,143,0.04)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHollow: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: SystemTokens.textMuted,
  },
  iconFilled: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 15,
    color: SystemTokens.textPrimary,
    letterSpacing: -0.1,
  },
  titleDone: {
    color: SystemTokens.textMuted,
    textDecorationLine: 'line-through',
  },
  desc: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: SystemTokens.textMuted,
    marginTop: 4,
    marginLeft: 28,
    lineHeight: 18,
  },
  descDone: {
    opacity: 0.6,
  },
  timeGate: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: SystemTokens.gold,
    marginTop: 4,
    marginLeft: 28,
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginLeft: 28,
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
    fontSize: 12,
    color: SystemTokens.cyan,
    letterSpacing: 0.6,
  },
  xpDone: {
    color: SystemTokens.textMuted,
  },
});

export default React.memo(MissionLogCard);
