import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

export type MemberRowProps = {
  rank: number;
  username: string;
  avatarUrl?: string | null;
  focusMinutes: number;
  missionsDone: number;
  streakDays: number;
  totalScore: number;
  isCurrentUser: boolean;
  isLast?: boolean;
  onRemove?: () => void;
};

const RANK_GOLD = '#FFD700';
const RANK_SILVER = '#C0C0C0';
const RANK_BRONZE = '#CD7F32';

function rankColor(rank: number): string {
  if (rank === 1) return RANK_GOLD;
  if (rank === 2) return RANK_SILVER;
  if (rank === 3) return RANK_BRONZE;
  return Colors.textMuted;
}

function rankIcon(rank: number): string | null {
  if (rank === 1) return 'trophy';
  if (rank === 2) return 'medal';
  if (rank === 3) return 'medal-outline';
  return null;
}

const MemberRow: React.FC<MemberRowProps> = ({
  rank,
  username,
  avatarUrl,
  focusMinutes,
  missionsDone,
  streakDays,
  totalScore,
  isCurrentUser,
  isLast,
  onRemove,
}) => {
  const initial = username.trim().charAt(0).toUpperCase() || '?';
  const rColor = rankColor(rank);
  const icon = rankIcon(rank);

  return (
    <View
      style={[
        styles.card,
        isCurrentUser && styles.cardCurrent,
        !isLast && styles.cardSpacing,
      ]}
    >
      {/* Rank */}
      <View style={styles.rankCol}>
        {icon ? (
          <Ionicons name={icon as any} size={16} color={rColor} />
        ) : (
          <Text style={[styles.rankText, { color: rColor }]}>{rank}</Text>
        )}
      </View>

      {/* Avatar + Name row */}
      <View style={[styles.avatarCircle, isCurrentUser && styles.avatarCircleCurrent]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarLetter}>{initial}</Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.username} numberOfLines={1}>
          {username}
          {isCurrentUser && <Text style={styles.youTag}> (you)</Text>}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.statText}>{focusMinutes}m</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="flag-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.statText}>{missionsDone}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="flame-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.statText}>{streakDays}d</Text>
          </View>
        </View>
      </View>

      {/* Score + optional remove */}
      <View style={styles.rightCol}>
        <View style={styles.scoreCol}>
          <Text style={[styles.score, isCurrentUser && styles.scoreCurrent]}>{totalScore}</Text>
          <Text style={styles.scoreLabel}>pts</Text>
        </View>
        {onRemove && (
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={8}
            style={styles.removeBtn}
            accessibilityLabel={`Remove ${username}`}
          >
            <Ionicons name="close-circle" size={18} color={Colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  cardCurrent: {
    backgroundColor: 'rgba(58,102,255,0.08)',
    borderColor: 'rgba(58,102,255,0.2)',
  },
  cardSpacing: {
    marginBottom: 8,
  },
  rankCol: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 15,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(44,52,64,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  avatarCircleCurrent: {
    borderColor: 'rgba(58,102,255,0.3)',
    backgroundColor: 'rgba(58,102,255,0.1)',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarLetter: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  info: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  username: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  youTag: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  scoreCol: {
    alignItems: 'flex-end',
  },
  score: {
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  scoreCurrent: {
    color: Colors.primary,
  },
  scoreLabel: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  removeBtn: {
    padding: 4,
    opacity: 0.7,
  },
});

export default MemberRow;
