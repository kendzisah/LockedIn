import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import LeaderboardService, {
  LeaderboardEntry,
  UserRankInfo,
  type DisciplineTier,
  disciplineTierBadgeShort,
} from '../LeaderboardService';
import { getCurrentSeasonId } from '../seasonDiscipline';
import { useAuth } from '../../auth/AuthProvider';

const LeaderboardScreen: React.FC = () => {
  const { user } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<UserRankInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    loadData(userId);
  }, [userId]);

  const loadData = async (currentUserId: string) => {
    try {
      setLoading(true);
      const [leaderboard, rank] = await Promise.all([
        LeaderboardService.getLeaderboard(50),
        LeaderboardService.getUserRank(currentUserId),
      ]);

      setLeaderboardData(leaderboard);
      setUserRank(rank);
    } catch (error) {
      console.error('[LeaderboardScreen] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    await loadData(userId);
    setRefreshing(false);
  };

  const getTierColor = (tier: DisciplineTier): string => {
    const map: Record<DisciplineTier, string> = {
      Recruit: '#6B7280',
      Soldier: '#9CA3AF',
      Vet: '#CD7F32',
      OG: '#C0C0C0',
      Elite: Colors.primary,
      Legend: '#FFD700',
      Goat: '#00D68F',
      Immortal: '#B9F2FF',
      'Locked In': Colors.accent,
    };
    return map[tier] ?? Colors.textSecondary;
  };

  const tierBadgeFg = (tier: DisciplineTier): string => {
    if (tier === 'Locked In' || tier === 'Legend' || tier === 'Goat' || tier === 'Vet' || tier === 'Immortal') {
      return Colors.background;
    }
    return Colors.textPrimary;
  };

  const TierBadge: React.FC<{ tier: DisciplineTier; size?: 'small' | 'large' }> = ({
    tier,
    size = 'small',
  }) => {
    const label = disciplineTierBadgeShort(tier);
    const badgeSize = size === 'small' ? 22 : 34;
    const fontSize = size === 'small' ? (label.length >= 2 ? 8 : 10) : label.length >= 2 ? 11 : 14;

    return (
      <View
        style={[
          styles.tierBadge,
          {
            backgroundColor: getTierColor(tier),
            minWidth: badgeSize,
            height: badgeSize,
            paddingHorizontal: label.length > 1 ? 3 : 0,
          },
        ]}
      >
        <Text
          style={[
            styles.tierBadgeText,
            {
              fontSize,
              color: tierBadgeFg(tier),
            },
          ]}
        >
          {label}
        </Text>
      </View>
    );
  };

  const renderLeaderboardEntry: ListRenderItem<LeaderboardEntry> = ({
    item,
    index,
  }) => {
    const isCurrentUser = userId && item.user_id === userId;

    return (
      <View
        style={[
          styles.leaderboardRow,
          isCurrentUser && {
            borderLeftWidth: 3,
            borderLeftColor: Colors.accent,
            backgroundColor: Colors.surface,
          },
        ]}
      >
        <Text style={styles.rankNumber}>#{item.rank}</Text>

        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.score}>{item.score} pts</Text>
        </View>

        <TierBadge tier={item.tier} size="small" />

        <Text style={[styles.grade, { color: getGradeColor(item.grade) }]}>
          {item.grade}
        </Text>
      </View>
    );
  };

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A+':
      case 'A':
        return Colors.accent;
      case 'B+':
      case 'B':
        return Colors.primary;
      case 'C':
        return Colors.textSecondary;
      case 'D':
      case 'F':
        return Colors.danger;
      default:
        return Colors.textPrimary;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <View>
          <View style={styles.headerTitleContainer}>
            <MaterialIcons name="emoji-events" size={24} color={Colors.accent} />
            <Text style={styles.headerTitle}>Discipline Board</Text>
          </View>
          <Text style={styles.seasonCaption}>
            Season {getCurrentSeasonId()} · 90-day seasons (~3 mo). Locked In tier needs top score plus
            81+ perfect mission days.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            // Note: You may need to import RefreshControl for full implementation
            undefined
          }
        >
          {/* User's Card */}
          {userRank && userRank.rank > 0 && (
            <View style={styles.userCardSection}>
              <View
                style={[
                  styles.userCard,
                  { borderColor: Colors.accent, borderWidth: 2 },
                ]}
              >
                <View style={styles.userCardContent}>
                  <View style={styles.userCardLeft}>
                    <Text style={styles.userCardRank}>#{userRank.rank}</Text>
                    <TierBadge tier={userRank.tier} size="large" />
                  </View>

                  <View style={styles.userCardCenter}>
                    <Text style={styles.userCardLabel}>Your Rank</Text>
                    <Text style={styles.userCardScore}>{userRank.score}</Text>
                    <Text style={styles.userCardPercentile}>
                      Top {userRank.percentile}%
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Leaderboard List */}
          {leaderboardData.length > 0 ? (
            <View style={styles.leaderboardContainer}>
              <Text style={styles.leaderboardTitle}>Top Performers</Text>

              {leaderboardData.map((entry, index) => (
                <View key={`${entry.rank}-${index}`}>
                  {renderLeaderboardEntry({ item: entry, index, separators: { highlight: () => {}, unhighlight: () => {}, updateProps: () => {} } })}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons
                name="trending-up"
                size={48}
                color={Colors.textSecondary}
              />
              <Text style={styles.emptyStateTitle}>No scores this season yet</Text>
              <Text style={styles.emptyStateText}>
                The board resets each 90-day season. Complete missions and lock in sessions to climb the
                ranks.
              </Text>
            </View>
          )}

          {/* Footer Info */}
          {userRank && userRank.rank > 0 && (
            <View style={styles.footerInfo}>
              <Text style={styles.footerText}>
                Your Rank: <Text style={styles.footerHighlight}>#{userRank.rank}</Text>
              </Text>
              <Text style={styles.footerText}>
                Top <Text style={styles.footerHighlight}>{userRank.percentile}%</Text>
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.backgroundSecondary,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textPrimary,
  },
  seasonCaption: {
    marginTop: 8,
    paddingRight: 8,
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCardSection: {
    marginBottom: 24,
  },
  userCard: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  userCardLeft: {
    alignItems: 'center',
    gap: 8,
  },
  userCardRank: {
    fontSize: 24,
    fontFamily: FontFamily.headingBold,
    color: Colors.accent,
  },
  userCardCenter: {
    flex: 1,
    gap: 4,
  },
  userCardLabel: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
  },
  userCardScore: {
    fontSize: 20,
    fontFamily: FontFamily.headingBold,
    color: Colors.textPrimary,
  },
  userCardPercentile: {
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.accent,
  },
  leaderboardContainer: {
    marginBottom: 20,
  },
  leaderboardTitle: {
    fontSize: 16,
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    gap: 12,
  },
  rankNumber: {
    fontSize: 16,
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.accent,
    minWidth: 40,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  username: {
    fontSize: 14,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.textPrimary,
  },
  score: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
  },
  tierBadge: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierBadgeText: {
    fontFamily: FontFamily.headingBold,
  },
  grade: {
    fontSize: 14,
    fontFamily: FontFamily.headingSemiBold,
    minWidth: 30,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textPrimary,
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280,
  },
  footerInfo: {
    marginTop: 32,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
  },
  footerHighlight: {
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.accent,
  },
});

export default LeaderboardScreen;
