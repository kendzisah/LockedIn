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

const RANK_GOLD = '#FFD700';

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
  const isFirst = myRank === 1;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      <View style={styles.cardGlow} />

      <View style={styles.topRow}>
        <View style={styles.nameCol}>
          <Text style={styles.crewName} numberOfLines={1}>
            {crewName}
          </Text>
          <View style={styles.memberBadge}>
            <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.memberCount}>
              {memberCount}/{maxMembers}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, isFirst && styles.statValueGold]}>
            {myRank != null ? `#${myRank}` : '—'}
          </Text>
          <Text style={styles.statLabel}>Rank</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{myScore}</Text>
          <Text style={styles.statLabel}>Score</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fillPct}%` }]} />
        {fillPct > 0 && (
          <View
            style={[
              styles.fillGlow,
              { width: `${fillPct}%` },
            ]}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    padding: 16,
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(58,102,255,0.05)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nameCol: {
    flex: 1,
    gap: 6,
  },
  crewName: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCount: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 14,
    gap: 16,
  },
  statBlock: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  statValueGold: {
    color: RANK_GOLD,
  },
  statLabel: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  track: {
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
  fillGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 3,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
});

export default CrewCard;
