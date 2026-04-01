import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import Colors from '../../../constants/Colors';
import FontFamily from '../../../constants/FontFamily';
import LeaderboardService, {
  LeaderboardEntry,
  UserRankInfo,
  TierType,
} from '../LeaderboardService';

interface UserContextData {
  user?: {
    id: string;
  };
}

const LeaderboardScreen: React.FC = () => {
  const navigation = useNavigation();

  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<UserRankInfo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Get user ID from context/auth
    // For now, we'll use a placeholder
    const currentUserId = 'current-user-id'; // TODO: Get from auth context
    setUserId(currentUserId);
    loadData(currentUserId);
  }, []);

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

  const getTierColor = (tier: TierType): string => {
    switch (tier) {
      case 'Locked In Elite':
        return Colors.accent; // Electric Cyan
      case 'Diamond':
        return '#B9F2FF';
      case 'Gold':
        return '#FFD700';
      case 'Silver':
        return '#C0C0C0';
      case 'Bronze':
        return '#CD7F32';
      default:
        return Colors.textSecondary;
    }
  };

  const TierBadge: React.FC<{ tier: TierType; size?: 'small' | 'large' }> = ({
    tier,
    size = 'small',
  }) => {
    const badgeSize = size === 'small' ? 20 : 32;
    const fontSize = size === 'small' ? 10 : 14;

    return (
      <View
        style={[
          styles.tierBadge,
          {
            backgroundColor: getTierColor(tier),
            width: badgeSize,
            height: badgeSize,
          },
        ]}
      >
        <Text
          style={[
            styles.tierBadgeText,
            {
              fontSize,
              color:
                tier === 'Locked In Elite' || tier === 'Gold'
                  ? Colors.background
                  : Colors.textPrimary,
            },
          ]}
        >
          {tier[0]}
        </Text>
      </View>
    );
  };

  const renderLeaderboardEntry: ListRenderItem<LeaderboardEntry> = ({
    item,
    index,
  }) => {
    const isCurrentUser = userId && leaderboardData[index]?.username === `User ${userId.substring(0, 8)}`;

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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <MaterialIcons name="emoji-events" size={24} color={Colors.accent} />
          <Text style={styles.headerTitle}>Discipline Board</Text>
        </View>

        <View style={{ width: 24 }} />
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
                  {renderLeaderboardEntry({ item: entry, index })}
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
              <Text style={styles.emptyStateTitle}>Scores update weekly</Text>
              <Text style={styles.emptyStateText}>
                Check back next Sunday for the leaderboard update
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
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
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
