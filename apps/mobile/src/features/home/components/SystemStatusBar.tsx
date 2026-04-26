/**
 * SystemStatusBar — The single unified character HUD for HomeTab. Reads
 * like an in-game stat sheet: rank pill + OVR block, progress to next
 * rank, 5 micro stat bars, the week-at-a-glance dots, and a streak
 * counter — all in one bracketed panel.
 *
 * Subscribes to StatsService for live updates. Tap to open the full
 * character sheet on the Profile tab.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList, TabParamList } from '../../../types/navigation';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { Stat, UserStatsRow } from '@lockedin/shared-types';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { StatsService } from '../../../services/StatsService';
import { RankService } from '../../../services/RankService';
import { useSession } from '../state/SessionProvider';
import { getTodayKey } from '../engine/SessionEngine';
import {
  getStreakTierInfo,
  getFlameColorFilters,
} from '../../../design/streakTiers';
import FocusRing from './FocusRing';
import CompactMissions from './CompactMissions';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'HomeTab'>,
  NativeStackNavigationProp<MainStackParamList>
>;

const STAT_COLORS: Record<Stat, string> = {
  discipline:  '#3A66FF',
  focus:       '#00C2FF',
  execution:   '#00D68F',
  consistency: '#FFC857',
  social:      '#A855F7',
};

const STAT_ROWS: { key: Stat; label: string }[] = [
  { key: 'discipline',  label: 'DIS' },
  { key: 'focus',       label: 'FOC' },
  { key: 'execution',   label: 'EXE' },
  { key: 'consistency', label: 'CON' },
  { key: 'social',      label: 'SOC' },
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
  focused: number;
  goal: number;
  streakAtRisk?: boolean;
  onMissionsPress?: () => void;
}

const SystemStatusBar: React.FC<SystemStatusBarProps> = ({
  focused,
  goal,
  streakAtRisk,
  onMissionsPress,
}) => {
  const navigation = useNavigation<Nav>();
  const { state: session } = useSession();
  const [stats, setStats] = useState<UserStatsRow | null>(StatsService.getCached());

  useEffect(() => {
    void StatsService.refresh();
    return StatsService.subscribe(setStats);
  }, []);

  const streakDays = session.consecutiveStreak;
  const currentRank = RankService.rankFromStreak(streakDays);
  const nextRank = RankService.nextRank(streakDays);
  const progress = RankService.progressToNext(streakDays);
  const ovr = stats?.ovr ?? 1;
  const totalXp = stats?.total_xp ?? 0;

  // Week dot computation (mirrors DayDots logic)
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

  // Streak flame tinting
  const streakTier = useMemo(() => getStreakTierInfo(streakDays), [streakDays]);
  const flameFilters = useMemo(
    () => getFlameColorFilters(streakTier.color, streakTier.colorLight),
    [streakTier.color, streakTier.colorLight],
  );

  return (
    <View style={styles.card}>
      {/* Glow orb tinted by current rank */}
      <View
        style={[
          styles.glowOrb,
          { backgroundColor: `${currentRank.color}10` },
        ]}
        pointerEvents="none"
      />

      {/* Corner brackets — give it the SAO HUD feel */}
      <View style={[styles.corner, styles.cornerTL, { borderColor: currentRank.color }]} />
      <View style={[styles.corner, styles.cornerTR, { borderColor: currentRank.color }]} />
      <View style={[styles.corner, styles.cornerBL, { borderColor: currentRank.color }]} />
      <View style={[styles.corner, styles.cornerBR, { borderColor: currentRank.color }]} />

      {/* Tappable identity zone — opens character sheet */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ProfileTab' as never)}
      >
      {/* ── Header bar ── */}
      <View style={styles.headerBar}>
        <Text style={styles.eyebrow}>// SYSTEM</Text>
        <Text style={styles.eyebrowMuted}>{totalXp.toLocaleString()} XP</Text>
      </View>

      {/* ── Identity row: OVR + rank ── */}
      <View style={styles.mainRow}>
        <View style={[styles.ovrBlock, { borderColor: `${currentRank.color}55` }]}>
          <Text style={styles.ovrLabel}>OVR</Text>
          <Text style={styles.ovrValue}>{ovr}</Text>
        </View>

        <View style={styles.rankCol}>
          <Text style={[styles.rankName, { color: currentRank.color }]}>
            {currentRank.name}
          </Text>
          <Text style={styles.rankSub}>Day {streakDays}</Text>

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
                  {' '}· {Math.max(0, nextRank.minDays - streakDays)}d
                </Text>
              </Text>
            </View>
          ) : (
            <Text style={styles.maxText}>MAX RANK</Text>
          )}
        </View>
      </View>

      {/* ── Stat bars ── */}
      <View style={styles.statsBlock}>
        {STAT_ROWS.map((row) => {
          const value = stats?.[row.key] ?? 1;
          const pct = (value / 99) * 100;
          return (
            <View key={row.key} style={styles.statRow}>
              <Text style={[styles.statLabel, { color: STAT_COLORS[row.key] }]}>
                {row.label}
              </Text>
              <View style={styles.statTrack}>
                <View
                  style={[
                    styles.statFill,
                    {
                      width: `${Math.max(2, pct)}%`,
                      backgroundColor: STAT_COLORS[row.key],
                    },
                  ]}
                />
              </View>
              <Text style={styles.statValueText}>{value}</Text>
            </View>
          );
        })}
      </View>

      {/* ── Week section ── */}
      <View style={styles.sectionDivider}>
        <Text style={styles.sectionLabel}>// WEEK</Text>
        <View style={styles.dividerLine} />
      </View>

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
              <Text
                style={[
                  styles.dayLabel,
                  isToday && styles.dayLabelToday,
                  isCompleted && styles.dayLabelCompleted,
                  isMissed && styles.dayLabelMissed,
                ]}
              >
                {label}
              </Text>
              <View
                style={[
                  styles.dayDot,
                  isCompleted && styles.dayDotCompleted,
                  isMissed && styles.dayDotMissed,
                  isToday && !isCompleted && styles.dayDotToday,
                  isFuture && styles.dayDotFuture,
                ]}
              >
                {isCompleted && (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                )}
                {isMissed && (
                  <Ionicons name="close" size={11} color={Colors.danger} />
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Streak section ── */}
      <View style={styles.sectionDivider}>
        <Text style={styles.sectionLabel}>// STREAK</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.streakRow}>
        <View style={styles.flameWrap}>
          <LottieView
            source={require('../../../../assets/lottie/fire.json')}
            autoPlay
            loop
            style={styles.flame}
            colorFilters={streakDays > 0 ? flameFilters : undefined}
          />
        </View>
        <Text
          style={[
            styles.streakValue,
            streakDays > 0 && { color: streakTier.color },
          ]}
        >
          {streakDays}
        </Text>
        <Text style={styles.streakLabel}>
          {streakDays === 1 ? 'DAY' : 'DAYS'}
        </Text>
        <View style={styles.streakSpacer} />
        <Text style={styles.streakHint}>
          {streakDays === 0 ? 'lock in to start' : 'don\'t break it'}
        </Text>
      </View>
      </TouchableOpacity>

      {/* ── Focus section ── */}
      <View style={styles.sectionDivider}>
        <Text style={styles.sectionLabel}>// FOCUS</Text>
        <View style={styles.dividerLine} />
        <Text style={styles.sectionMeta}>
          {focused}/{goal} MIN
        </Text>
      </View>

      <View style={styles.focusSlot}>
        <FocusRing focused={focused} goal={goal} streakAtRisk={streakAtRisk} />
      </View>

      {/* ── Missions section ── */}
      <View style={styles.sectionDivider}>
        <Text style={styles.sectionLabel}>// MISSIONS</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.missionsSlot}>
        <CompactMissions onPress={onMissionsPress ?? (() => {})} />
      </View>
    </View>
  );
};

const CORNER_SIZE = 10;
const CORNER_THICKNESS = 1.5;
const DAY_DOT_SIZE = 24;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(14,17,22,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  eyebrow: {
    fontFamily: FontFamily.headingBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.accent,
  },
  eyebrowMuted: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
  },
  ovrBlock: {
    width: 64,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  ovrLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.textMuted,
  },
  ovrValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    lineHeight: 36,
    color: Colors.textPrimary,
  },
  rankCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  rankName: {
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    letterSpacing: 1.4,
  },
  rankSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  progressBlock: {
    marginTop: 4,
    gap: 3,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  progressHint: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  progressHintMuted: {
    color: Colors.textMuted,
  },
  progressNextRank: {
    fontFamily: FontFamily.headingSemiBold,
  },
  maxText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: Colors.warning,
  },
  statsBlock: {
    marginTop: 12,
    gap: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    width: 28,
    fontFamily: FontFamily.headingBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  statTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  statFill: {
    height: '100%',
    borderRadius: 2,
  },
  statValueText: {
    width: 20,
    textAlign: 'right',
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: Colors.textMuted,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayCol: {
    alignItems: 'center',
    gap: 4,
  },
  dayLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  dayLabelToday: {
    color: Colors.accent,
  },
  dayLabelCompleted: {
    color: Colors.primary,
  },
  dayLabelMissed: {
    color: Colors.danger,
  },
  dayDot: {
    width: DAY_DOT_SIZE,
    height: DAY_DOT_SIZE,
    borderRadius: DAY_DOT_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotCompleted: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayDotMissed: {
    backgroundColor: 'rgba(255,71,87,0.12)',
    borderColor: 'rgba(255,71,87,0.5)',
  },
  dayDotToday: {
    borderColor: Colors.accent,
    borderWidth: 1.5,
  },
  dayDotFuture: {
    opacity: 0.4,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flameWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flame: {
    width: 30,
    height: 30,
  },
  streakValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.textMuted,
    letterSpacing: -0.3,
  },
  streakLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
  },
  streakSpacer: {
    flex: 1,
  },
  streakHint: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.3,
    fontStyle: 'italic',
  },
  sectionMeta: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  focusSlot: {
    alignItems: 'center',
    marginTop: -8,
    marginBottom: -8,
  },
  missionsSlot: {
    marginHorizontal: -14,
    marginBottom: -10,
  },
});

export default SystemStatusBar;
