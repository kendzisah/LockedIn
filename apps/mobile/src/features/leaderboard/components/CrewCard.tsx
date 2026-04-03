import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

export type CrewCardProps = {
  crewName: string;
  memberCount: number;
  maxMembers: number;
  myRank: number | null;
  myScore: number;
  topScore: number;
  onPress: () => void;
};

const GOLD = '#FFC857';

const CrewCard: React.FC<CrewCardProps> = ({
  crewName,
  memberCount,
  maxMembers,
  myRank,
  myScore,
  topScore,
  onPress,
}) => {
  const fillPct =
    topScore > 0 ? Math.min(100, Math.max(0, (myScore / topScore) * 100)) : 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      <View style={styles.row1}>
        <Text style={styles.crewName} numberOfLines={1}>
          {crewName}
        </Text>
        <View style={styles.memberMeta}>
          <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.memberCount}>
            {memberCount}/{maxMembers}
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.rankLine,
          myRank === 1 && styles.rankLineGold,
        ]}
        numberOfLines={1}
      >
        {myRank != null
          ? `Your rank: #${myRank}`
          : 'No activity this week'}
      </Text>

      <View style={styles.scoreAboveRow}>
        <Text style={styles.scoreAbove}>{myScore}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fillPct}%` }]} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(21,26,33,0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 16,
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  crewName: {
    flex: 1,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCount: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  rankLine: {
    marginTop: 8,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  rankLineGold: {
    color: GOLD,
  },
  scoreAboveRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  scoreAbove: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  track: {
    marginTop: 4,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(44,52,64,0.5)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
});

export default CrewCard;
