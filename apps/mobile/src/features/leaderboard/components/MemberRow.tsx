import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

export type MemberRowProps = {
  rank: number;
  username: string;
  focusMinutes: number;
  missionsDone: number;
  streakDays: number;
  totalScore: number;
  isCurrentUser: boolean;
  isLast?: boolean;
};

const RANK_GOLD = '#FFC857';
const RANK_SILVER = '#C0C0C0';
const RANK_BRONZE = '#CD7F32';

function rankColor(rank: number): string {
  if (rank === 1) return RANK_GOLD;
  if (rank === 2) return RANK_SILVER;
  if (rank === 3) return RANK_BRONZE;
  return Colors.textSecondary;
}

const MemberRow: React.FC<MemberRowProps> = ({
  rank,
  username,
  focusMinutes,
  missionsDone,
  streakDays,
  totalScore,
  isCurrentUser,
  isLast,
}) => {
  const initial = username.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      style={[
        styles.row,
        isCurrentUser && styles.rowCurrent,
        !isLast && styles.rowBorder,
      ]}
    >
      <Text style={[styles.rank, { color: rankColor(rank) }]}>{rank}</Text>

      <View style={styles.middle}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{initial}</Text>
        </View>
        <Text style={styles.username} numberOfLines={1}>
          {username}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.statText}>{focusMinutes}m</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="flag-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.statText}>{missionsDone}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="flame-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.statText}>{streakDays}d</Text>
          </View>
        </View>
      </View>

      <Text style={styles.score}>{totalScore}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowCurrent: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    backgroundColor: 'rgba(58,102,255,0.06)',
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rank: {
    width: 28,
    fontFamily: FontFamily.heading,
    fontSize: 16,
    textAlign: 'center',
  },
  middle: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(44,52,64,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  username: {
    marginTop: 6,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  score: {
    fontFamily: FontFamily.heading,
    fontSize: 15,
    color: Colors.textPrimary,
    marginLeft: 8,
  },
});

export default MemberRow;
