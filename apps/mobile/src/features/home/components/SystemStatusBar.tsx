/**
 * SystemStatusBar — The character HUD panel. Identity (OVR + rank +
 * progress to next), 5 animated stat bars, week-at-a-glance blocks,
 * and a streak status readout. Subscribes to StatsService for live
 * updates. Tap to open the full character sheet on the Profile tab.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { Stat, UserStatsRow } from '@lockedin/shared-types';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '../../../design/typography';
import type { MainStackParamList, TabParamList } from '../../../types/navigation';
import { StatsService } from '../../../services/StatsService';
import { RankService } from '../../../services/RankService';
import { SupabaseService } from '../../../services/SupabaseService';
import { useAuth } from '../../auth/AuthProvider';
import { useSession } from '../state/SessionProvider';
import { getTodayKey } from '../engine/SessionEngine';
import HUDPanel from './HUDPanel';
import StatBar from './StatBar';
import {
  STAT_COLORS,
  STAT_LABELS,
  SectionLabelStyle,
  SystemTokens,
} from '../systemTokens';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'HomeTab'>,
  NativeStackNavigationProp<MainStackParamList>
>;

const STAT_ROWS: Stat[] = [
  'discipline',
  'focus',
  'execution',
  'consistency',
  'social',
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getCurrentWeekDayKeys(): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + mondayOffset + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    keys.push(`${year}-${month}-${day}`);
  }
  return keys;
}

interface SystemStatusBarProps {
  streakAtRisk?: boolean;
}

const SystemStatusBar: React.FC<SystemStatusBarProps> = ({ streakAtRisk }) => {
  const navigation = useNavigation<Nav>();
  const { state: session } = useSession();
  const { isAnonymous } = useAuth();
  const [stats, setStats] = useState<UserStatsRow | null>(StatsService.getCached());
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    void StatsService.refresh();
    return StatsService.subscribe(setStats);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (isAnonymous) {
        setAvatarUrl(null);
        setDisplayName(null);
        return;
      }
      let cancelled = false;
      (async () => {
        const client = SupabaseService.getClient();
        const uid = SupabaseService.getCurrentUserId();
        if (!client || !uid) return;
        const { data } = await client
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', uid)
          .maybeSingle();
        if (cancelled) return;
        setAvatarUrl(data?.avatar_url ? String(data.avatar_url) : null);
        setDisplayName(data?.display_name ? String(data.display_name) : null);
      })();
      return () => {
        cancelled = true;
      };
    }, [isAnonymous]),
  );

  const streakDays = session.consecutiveStreak;
  const currentRank = RankService.rankFromStreak(streakDays);
  const nextRank = RankService.nextRank(streakDays);
  const progress = RankService.progressToNext(streakDays);
  const ovr = stats?.ovr ?? 1;
  const totalXp = stats?.total_xp ?? 0;

  const todayKey = useMemo(() => getTodayKey(), []);
  const weekKeys = useMemo(() => getCurrentWeekDayKeys(), []);
  const completedSet = useMemo(() => {
    const s = new Set<string>();
    const week = new Set(weekKeys);
    for (const dk of session.weekCompletedDays ?? []) {
      if (week.has(dk)) s.add(dk);
    }
    if (session.lastLockInCompletedDate && week.has(session.lastLockInCompletedDate)) {
      s.add(session.lastLockInCompletedDate);
    }
    if (session.lastSessionDayKey && week.has(session.lastSessionDayKey)) {
      s.add(session.lastSessionDayKey);
    }
    return s;
  }, [
    session.weekCompletedDays,
    session.lastLockInCompletedDate,
    session.lastSessionDayKey,
    weekKeys,
  ]);

  const ovrGlow = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ovrGlow, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(ovrGlow, {
          toValue: 0.5,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ovrGlow]);

  const todayPulse = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(todayPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(todayPulse, {
          toValue: 0.6,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [todayPulse]);

  const ovrShadowRadius = ovrGlow.interpolate({
    inputRange: [0.5, 1],
    outputRange: [6, 10],
  });

  const streakStatus = streakAtRisk
    ? { label: 'STATUS: AT RISK', color: SystemTokens.red }
    : streakDays === 0
      ? { label: 'STATUS: INACTIVE', color: SystemTokens.textMuted }
      : {
          label: `STATUS: ACTIVE · ×${(1 + Math.min(streakDays / 30, 0.5)).toFixed(1)} MULT`,
          color: SystemTokens.gold,
        };

  return (
    <HUDPanel
      headerLabel="STATUS"
      headerRight={`${totalXp.toLocaleString()} XP`}
      accentColor={currentRank.color}
      onPress={() => navigation.navigate('ProfileTab' as never)}
    >
      {/* ── Identity row: Avatar · Rank · OVR ── */}
      <View style={styles.mainRow}>
        <View style={styles.avatarCol}>
          <Text style={styles.avatarName} numberOfLines={1}>
            {((displayName?.trim() || 'Anonymous')).slice(0, 16)}
          </Text>
          <View style={[styles.avatarBlock, { borderColor: `${currentRank.color}55` }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarLetter}>
                {(displayName?.trim().charAt(0) ?? 'A').toUpperCase()}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.rankCol}>
          <View style={styles.rankRow}>
            <Text
              style={[
                styles.rankName,
                {
                  color: currentRank.color,
                  textShadowColor: `${currentRank.color}66`,
                  textShadowRadius: 8,
                  textShadowOffset: { width: 0, height: 0 },
                },
              ]}
              numberOfLines={1}
            >
              {currentRank.name}
            </Text>
            <Animated.Text
              style={[
                styles.ovrInline,
                {
                  color: currentRank.color,
                  textShadowColor: currentRank.color,
                  textShadowRadius: ovrShadowRadius as unknown as number,
                  textShadowOffset: { width: 0, height: 0 },
                },
              ]}
            >
              <Text style={styles.ovrInlineLabel}>OVR </Text>
              {ovr}
            </Animated.Text>
          </View>

          <Text style={styles.rankSub}>DAY {streakDays}</Text>

          {nextRank ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(2, progress * 100)}%`,
                      backgroundColor: currentRank.color,
                      shadowColor: currentRank.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressHint}>
                <Text style={styles.progressHintMuted}>NEXT: </Text>
                <Text style={[styles.progressNextRank, { color: nextRank.color }]}>
                  {nextRank.name}
                </Text>
                <Text style={styles.progressHintMuted}>
                  {' '}· {Math.max(0, nextRank.minDays - streakDays)}D
                </Text>
              </Text>
            </View>
          ) : (
            <Text style={styles.maxText}>MAX RANK</Text>
          )}
        </View>
      </View>

      {/* ── // STATS ── */}
      <SectionLabel label="STATS" />
      <View style={styles.statsBlock}>
        {STAT_ROWS.map((key, i) => (
          <StatBar
            key={key}
            label={STAT_LABELS[key]}
            value={stats?.[key] ?? 1}
            current={stats?.[key] ?? 1}
            max={99}
            color={STAT_COLORS[key]}
            delay={i * 100}
          />
        ))}
      </View>

      {/* ── // WEEK ── */}
      <SectionLabel label="WEEK" />
      <View style={styles.weekRow}>
        {DAY_LABELS.map((label, i) => {
          const dayKey = weekKeys[i];
          const isToday = dayKey === todayKey;
          const isCompleted = completedSet.has(dayKey);
          const isPast = dayKey < todayKey;
          const isFuture = dayKey > todayKey;
          const isMissed = isPast && !isCompleted;
          return (
            <View key={i} style={styles.dayCol}>
              {isToday && <View style={styles.todayMarker} />}
              <Text
                style={[
                  styles.dayLabel,
                  isToday && { color: SystemTokens.cyan },
                  isCompleted && { color: SystemTokens.green },
                  isMissed && { color: SystemTokens.red },
                ]}
              >
                {label}
              </Text>
              <Animated.View
                style={[
                  styles.dayBlock,
                  isCompleted && {
                    backgroundColor: SystemTokens.green,
                    borderColor: SystemTokens.green,
                  },
                  isMissed && {
                    backgroundColor: 'rgba(255,71,87,0.08)',
                    borderColor: 'rgba(255,71,87,0.6)',
                  },
                  isToday && !isCompleted && {
                    borderColor: SystemTokens.cyan,
                    borderWidth: 1.5,
                    backgroundColor: 'rgba(0,194,255,0.08)',
                    opacity: todayPulse,
                  },
                  isFuture && styles.dayBlockFuture,
                ]}
              >
                {isCompleted && (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                )}
                {isMissed && (
                  <Ionicons name="close" size={12} color={SystemTokens.red} />
                )}
              </Animated.View>
            </View>
          );
        })}
      </View>

      {/* ── // STREAK ── */}
      <SectionLabel label="STREAK" />
      <View style={styles.streakReadout}>
        <View style={styles.streakLeft}>
          <Text style={styles.streakNumeric}>
            {String(streakDays).padStart(2, '0')}
          </Text>
          <Text style={styles.streakUnit}>DAYS</Text>
        </View>
        <View style={styles.streakRight}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: streakStatus.color },
            ]}
          />
          <Text
            style={[styles.streakStatus, { color: streakStatus.color }]}
            numberOfLines={1}
          >
            {streakStatus.label}
          </Text>
        </View>
      </View>
    </HUDPanel>
  );
};

const SectionLabel: React.FC<{ label: string; right?: string }> = ({ label, right }) => (
  <View style={styles.sectionRow}>
    <Text style={styles.sectionLabel}>// {label}</Text>
    <View style={styles.sectionRule} />
    {right && <Text style={styles.sectionRight}>{right}</Text>}
  </View>
);

const styles = StyleSheet.create({
  mainRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
  },
  avatarCol: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  avatarName: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: SystemTokens.textSecondary,
    maxWidth: 60,
  },
  avatarBlock: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(58,102,255,0.06)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 60,
    height: 60,
  },
  avatarLetter: {
    fontFamily: FontFamily.headingBold,
    fontSize: 26,
    color: SystemTokens.textPrimary,
    letterSpacing: -0.5,
  },
  rankCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  rankName: {
    flex: 1,
    fontFamily: FontFamily.headingBold,
    fontSize: 20,
    letterSpacing: 1.6,
  },
  ovrInline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    letterSpacing: 0.6,
  },
  ovrInlineLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: SystemTokens.textMuted,
  },
  rankSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: SystemTokens.textSecondary,
    letterSpacing: 1.2,
  },
  progressBlock: {
    marginTop: 4,
    gap: 4,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  progressHint: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  progressHintMuted: {
    color: SystemTokens.textMuted,
  },
  progressNextRank: {
    fontFamily: FontFamily.headingSemiBold,
  },
  maxText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: SystemTokens.gold,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionLabel: {
    ...SectionLabelStyle,
    color: SystemTokens.textMuted,
    fontSize: 10,
    letterSpacing: 2,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: SystemTokens.divider,
  },
  sectionRight: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    color: SystemTokens.textMuted,
  },
  statsBlock: {
    gap: 5,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  dayCol: {
    alignItems: 'center',
    gap: 4,
  },
  todayMarker: {
    position: 'absolute',
    top: -6,
    width: 1,
    height: 4,
    backgroundColor: 'rgba(0,194,255,0.5)',
  },
  dayLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: SystemTokens.textMuted,
  },
  dayBlock: {
    width: 26,
    height: 26,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: SystemTokens.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBlockFuture: {
    opacity: 0.45,
  },
  streakReadout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  streakNumeric: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    color: SystemTokens.textPrimary,
    letterSpacing: -0.5,
  },
  streakUnit: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: SystemTokens.textMuted,
  },
  streakRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  streakStatus: {
    fontFamily: FontFamily.headingBold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
});

export default SystemStatusBar;
