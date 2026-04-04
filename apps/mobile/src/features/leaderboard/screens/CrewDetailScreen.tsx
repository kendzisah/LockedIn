import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../types/navigation';
import { CrewService, type CrewDetails, type CrewLeaderboardEntry } from '../CrewService';
import { NotificationService } from '../../../services/NotificationService';
import { SupabaseService } from '../../../services/SupabaseService';
import MemberRow from '../components/MemberRow';
import InviteCodeCard from '../components/InviteCodeCard';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<MainStackParamList, 'CrewDetail'>;

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

const CrewDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { crew_id } = route.params;
  const currentWeekKey = useMemo(() => CrewService.getCurrentWeekKey(), []);
  const userId = SupabaseService.getCurrentUserId();

  const [details, setDetails] = useState<CrewDetails | null>(null);
  const [leaderboard, setLeaderboard] = useState<CrewLeaderboardEntry[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const selectedWeekKey = useMemo(() => getWeekKeyOffset(weekOffset), [weekOffset]);
  const isCurrentWeek = weekOffset === 0;
  const isOwner = details?.owner_id === userId;

  const fetchData = useCallback(async () => {
    const [d, lb] = await Promise.all([
      CrewService.getCrewDetails(crew_id),
      CrewService.getCrewLeaderboard(crew_id, selectedWeekKey),
    ]);
    setDetails(d);
    setLeaderboard(lb);
  }, [crew_id, selectedWeekKey]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  useEffect(() => {
    if (!details || !leaderboard.length || !userId) return;
    const me = leaderboard.find((e) => e.is_current_user);
    if (!me) return;
    void AsyncStorage.setItem(
      '@lockedin/crew_cached_rank',
      JSON.stringify({
        crew_name: details.name,
        rank: me.rank,
        crew_id,
      }),
    );
  }, [details, leaderboard, crew_id, userId]);

  const refreshNotificationsAfterCrewChange = useCallback(async () => {
    try {
      await CrewService.syncHasActiveCrewFlag();
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

  const handleMore = useCallback(() => {
    const options: string[] = ['Share Invite Code'];
    if (isOwner) {
      options.push('Delete Crew');
    } else {
      options.push('Leave Crew');
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
            // Share is handled by InviteCodeCard, but we can re-trigger share
          } else if (idx === 1) {
            if (isOwner) {
              Alert.alert(
                'Delete Crew',
                `Are you sure you want to delete "${details?.name}"? This cannot be undone.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      const ok = await CrewService.deleteCrew(crew_id);
                      if (ok) {
                        await refreshNotificationsAfterCrewChange();
                        navigation.goBack();
                      } else Alert.alert('Error', 'Failed to delete crew.');
                    },
                  },
                ],
              );
            } else {
              Alert.alert(
                'Leave Crew',
                `Are you sure you want to leave "${details?.name}"?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                      const ok = await CrewService.leaveCrew(crew_id);
                      if (ok) {
                        await refreshNotificationsAfterCrewChange();
                        navigation.goBack();
                      } else Alert.alert('Error', 'Failed to leave crew.');
                    },
                  },
                ],
              );
            }
          }
        },
      );
    } else {
      // Android fallback
      const actions = isOwner
        ? [
            { text: 'Delete Crew', onPress: () => handleDeleteOrLeave('delete') },
          ]
        : [
            { text: 'Leave Crew', onPress: () => handleDeleteOrLeave('leave') },
          ];
      Alert.alert(details?.name ?? 'Options', undefined, [
        ...actions,
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [isOwner, details, crew_id, navigation, refreshNotificationsAfterCrewChange]);

  const handleDeleteOrLeave = useCallback(
    async (action: 'delete' | 'leave') => {
      if (action === 'delete') {
        const ok = await CrewService.deleteCrew(crew_id);
        if (ok) {
          await refreshNotificationsAfterCrewChange();
          navigation.goBack();
        } else Alert.alert('Error', 'Failed to delete crew.');
      } else {
        const ok = await CrewService.leaveCrew(crew_id);
        if (ok) {
          await refreshNotificationsAfterCrewChange();
          navigation.goBack();
        } else Alert.alert('Error', 'Failed to leave crew.');
      }
    },
    [crew_id, navigation, refreshNotificationsAfterCrewChange],
  );

  if (loading && !details) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {details?.name ?? ''}
        </Text>
        <TouchableOpacity onPress={handleMore} hitSlop={10}>
          <Ionicons name="ellipsis-vertical" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Week selector */}
      <View style={styles.weekSelector}>
        <TouchableOpacity
          onPress={() => setWeekOffset((o) => o - 1)}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>
          {formatWeekLabel(selectedWeekKey, currentWeekKey)}
        </Text>
        <TouchableOpacity
          onPress={() => setWeekOffset((o) => Math.min(o + 1, 0))}
          hitSlop={10}
          disabled={isCurrentWeek}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isCurrentWeek ? Colors.surface : Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Leaderboard */}
      {leaderboard.length === 0 ? (
        <View style={styles.emptyWeek}>
          <Text style={styles.emptyWeekText}>No activity this week</Text>
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
              focusMinutes={item.focus_minutes}
              missionsDone={item.missions_done}
              streakDays={item.streak_days}
              totalScore={item.total_score}
              isCurrentUser={item.is_current_user}
              isLast={index === leaderboard.length - 1}
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
            crewName={details.name}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    backgroundColor: 'rgba(21,26,33,0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  weekLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
    minWidth: 140,
    textAlign: 'center',
  },
  emptyWeek: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWeekText: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  listContent: {
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 34,
  },
});

export default CrewDetailScreen;
