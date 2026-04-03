/**
 * CompactMissions — Glassmorphic missions preview card for the home tab.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMissions } from '../../missions/MissionsProvider';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

interface CompactMissionsProps {
  onPress: () => void;
}

const CompactMissions: React.FC<CompactMissionsProps> = ({ onPress }) => {
  const { missions, completedCount } = useMissions();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Ionicons name="flash" size={12} color={Colors.accent} />
          </View>
          <Text style={styles.headerTitle}>Today's Missions</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{completedCount}/{missions.length}</Text>
        </View>
      </View>
      {missions.slice(0, 3).map((m) => (
        <View key={m.id} style={styles.row}>
          <View style={[styles.check, m.completed && styles.checkDone]}>
            {m.completed && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
          </View>
          <Text
            style={[styles.missionName, m.completed && styles.missionDone]}
            numberOfLines={1}
          >
            {m.title}
          </Text>
          <Text style={[styles.xp, m.completed && styles.xpDone]}>+{m.xp}</Text>
        </View>
      ))}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(21,26,33,0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(0,194,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(44,52,64,0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  pillText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 10,
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(44,52,64,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkDone: {
    backgroundColor: Colors.success,
    borderColor: 'rgba(0,214,143,0.3)',
  },
  missionName: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  missionDone: {
    textDecorationLine: 'line-through' as const,
    color: Colors.textMuted,
  },
  xp: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    color: '#FFC857',
  },
  xpDone: {
    color: Colors.textMuted,
  },
});

export default React.memo(CompactMissions);
