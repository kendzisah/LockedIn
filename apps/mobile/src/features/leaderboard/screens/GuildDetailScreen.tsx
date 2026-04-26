import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../types/navigation';
import { GuildService, type GuildDetails, type GuildLeaderboardEntry } from '../GuildService';
import { NotificationService } from '../../../services/NotificationService';
import { SupabaseService } from '../../../services/SupabaseService';
import { Analytics } from '../../../services/AnalyticsService';
import MemberRow from '../components/MemberRow';
import InviteCodeCard from '../components/InviteCodeCard';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<MainStackParamList, 'GuildDetail'>;

function getWeekKeyOffset(offset: number): string {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const isoYear = d.getFullYear();
  const yearStart = new Date(isoYear, 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
}

function formatWeekLabel(weekKey: string, currentWeekKey: string): string {
  if (weekKey === currentWeekKey) return 'This Week';
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekKey;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(year, 0, 4);
  const startOfWeek = new Date(jan4);
  startOfWeek.setDate(jan4.getDate() - jan4.getDay() + 1 + (week - 1) * 7);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(startOfWeek)} – ${fmt(endOfWeek)}`;
}

const GuildDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { guild_id } = route.params;
  const currentWeekKey = useMemo(() => GuildService.getCurrentWeekKey(), []);
  const userId = SupabaseService.getCurrentUserId();

  const [details, setDetails] = useState<GuildDetails | null>(null);
  const [leaderboard, setLeaderboard] = useState<GuildLeaderboardEntry[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const skipFocusRefetchOnce = useRef(true);

  const selectedWeekKey = useMemo(() => getWeekKeyOffset(weekOffset), [weekOffset]);
  const isCurrentWeek = weekOffset === 0;
  const isOwner = details?.owner_id === userId;

  const fetchData = useCallback(async () => {
    const [d, lb] = await Promise.all([
      GuildService.getGuildDetails(guild_id),
      GuildService.getGuildLeaderboard(guild_id, selectedWeekKey),
    ]);
    setDetails(d);
    setLeaderboard(lb);
  }, [guild_id, selectedWeekKey]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  // Refresh when returning to this screen; initial load is handled by useEffect above.
  useFocusEffect(
    useCallback(() => {
      if (skipFocusRefetchOnce.current) {
        skipFocusRefetchOnce.current = false;
        return;
      }
      void fetchData();
    }, [fetchData]),
  );

  useEffect(() => {
    if (!details || !leaderboard.length || !userId) return;
    const me = leaderboard.find((e) => e.is_current_user);
    Analytics.track('Guild Leaderboard Viewed', {
      guild_id,
      member_count: details.member_count,
      user_rank: me?.rank ?? 0,
    });
    if (!me) return;
    void AsyncStorage.setItem(
      '@lockedin/crew_cached_rank',
      JSON.stringify({
        guild_name: details.name,
        rank: me.rank,
        guild_id,
      }),
    );
  }, [details, leaderboard, guild_id, userId]);

  const refreshNotificationsAfterGuildChange = useCallback(async () => {
    try {
      await GuildService.syncHasActiveGuildFlag();
      await NotificationService.refreshScheduleWithStoredStreak();
    } catch {
      /* ignore */
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleDeleteOrLeave = useCallback(
    async (action: 'delete' | 'leave') => {
      if (action === 'delete') {
        const ok = await GuildService.deleteGuild(guild_id);
        if (ok) {
          Analytics.track('Guild Left', { guild_id, was_owner: true });
          await refreshNotificationsAfterGuildChange();
          navigation.goBack();
        } else Alert.alert('Error', 'Failed to delete guild.');
      } else {
        const ok = await GuildService.leaveGuild(guild_id);
        if (ok) {
          Analytics.track('Guild Left', { guild_id, was_owner: false });
          await refreshNotificationsAfterGuildChange();
          navigation.goBack();
        } else Alert.alert('Error', 'Failed to leave guild.');
      }
    },
    [guild_id, navigation, refreshNotificationsAfterGuildChange],
  );

  const handleKickMember = useCallback(
    (targetUserId: string, username: string) => {
      Alert.alert(
        'Remove Member',
        `Remove ${username} from this guild? Their scores will be deleted.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              const ok = await GuildService.kickMember(guild_id, targetUserId);
              if (ok) {
                await fetchData();
              } else {
                Alert.alert('Error', 'Failed to remove member.');
              }
            },
          },
        ],
      );
    },
    [guild_id, fetchData],
  );

  const handleMore = useCallback(() => {
    const options: string[] = ['Share Invite Code'];
    if (isOwner) {
      options.push('Delete Guild');
    } else {
      options.push('Leave Guild');
    }
    options.push('Cancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: 1,
          cancelButtonIndex: options.length - 1,
        },
        async (idx) => {
          if (idx === 0 && details) {
            Share.share({
              message: `Join my guild "${details.name}" on Locked In! My invite code: ${details.invite_code}`,
            });
          } else if (idx === 1) {
            if (isOwner) {
              Alert.alert(
                'Delete Guild',
                `Are you sure you want to delete "${details?.name}"? This cannot be undone.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDeleteOrLeave('delete'),
                  },
                ],
              );
            } else {
              Alert.alert(
                'Leave Guild',
                `Are you sure you want to leave "${details?.name}"?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: () => handleDeleteOrLeave('leave'),
                  },
                ],
              );
            }
          }
        },
      );
    } else {
      // Android: show options alert, then confirm destructive actions
      Alert.alert(details?.name ?? 'Options', undefined, [
        {
          text: 'Share Invite Code',
          onPress: () => {
            if (details) {
              Share.share({
                message: `Join my guild "${details.name}" on Locked In! My invite code: ${details.invite_code}`,
              });
            }
          },
        },
        {
          text: isOwner ? 'Delete Guild' : 'Leave Guild',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              isOwner ? 'Delete Guild' : 'Leave Guild',
              isOwner
                ? `Are you sure you want to delete "${details?.name}"? This cannot be undone.`
                : `Are you sure you want to leave "${details?.name}"?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: isOwner ? 'Delete' : 'Leave',
                  style: 'destructive',
                  onPress: () => handleDeleteOrLeave(isOwner ? 'delete' : 'leave'),
                },
              ],
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [isOwner, details, handleDeleteOrLeave]);

  if (loading && !details) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={['#0A1628', '#0E1116', '#0E1116']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0A1628', '#0E1116', '#0E1116']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowOrb} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {details?.name ?? ''}
            </Text>
            {details && (
              <View style={styles.headerMeta}>
                <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.headerMetaText}>
                  {details.member_count ?? 0} members
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleMore} hitSlop={10} style={styles.moreBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Week selector */}
        <View style={styles.weekSelector}>
          <TouchableOpacity
            onPress={() => setWeekOffset((o) => o - 1)}
            hitSlop={10}
            style={styles.weekArrow}
          >
            <Ionicons name="chevron-back" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.weekCenter}>
            <Text style={styles.weekLabel}>
              {formatWeekLabel(selectedWeekKey, currentWeekKey)}
            </Text>
            {isCurrentWeek && (
              <View style={styles.liveDot} />
            )}
          </View>
          <TouchableOpacity
            onPress={() => setWeekOffset((o) => Math.min(o + 1, 0))}
            hitSlop={10}
            disabled={isCurrentWeek}
            style={styles.weekArrow}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isCurrentWeek ? Colors.surface : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Leaderboard */}
        {leaderboard.length === 0 ? (
          <View style={styles.emptyWeek}>
            <Ionicons name="stats-chart-outline" size={40} color={Colors.textMuted} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyWeekTitle}>No activity yet</Text>
            <Text style={styles.emptyWeekText}>Start a focus session to get on the board</Text>
          </View>
        ) : (
          <FlatList
            data={leaderboard}
            keyExtractor={(item) => item.user_id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => (
              <MemberRow
                rank={item.rank}
                username={item.username}
                avatarUrl={item.avatar_url}
                focusMinutes={item.focus_minutes}
                missionsDone={item.missions_done}
                streakDays={item.streak_days}
                totalScore={item.total_score}
                isCurrentUser={item.is_current_user}
                isLast={index === leaderboard.length - 1}
                ovr={item.ovr}
                rankId={item.rank_id as never}
                onRemove={
                  isOwner && !item.is_current_user
                    ? () => handleKickMember(item.user_id, item.username)
                    : undefined
                }
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.primary}
              />
            }
          />
        )}

        {/* Invite code footer */}
        {details && (
          <View style={styles.footer}>
            <InviteCodeCard
              inviteCode={details.invite_code}
              guildName={details.name}
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowOrb: {
    position: 'absolute',
    top: 60,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(58,102,255,0.06)',
  },
  glowOrb2: {
    position: 'absolute',
    bottom: 100,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0,194,255,0.04)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerMetaText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    marginBottom: 12,
  },
  weekArrow: {
    padding: 4,
  },
  weekCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  emptyWeek: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 80,
  },
  emptyWeekTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  emptyWeekText: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(14,17,22,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
});

export default GuildDetailScreen;
