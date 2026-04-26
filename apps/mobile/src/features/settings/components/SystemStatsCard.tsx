/**
 * SystemStatsCard — Character-sheet card for the Settings/Profile screen.
 *
 * Shows the user's full system identity at a glance:
 *   - OVR + rank pill in the rank's color
 *   - 5 stat bars (Discipline / Focus / Execution / Consistency / Social)
 *     each with its assigned color and animated fill on mount
 *   - Total XP
 *   - Recent achievements row (horizontal pill list)
 *
 * Subscribes to StatsService for live updates.
 */

import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Stat, UserStatsRow } from '@lockedin/shared-types';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { StatsService } from '../../../services/StatsService';
import { RankService } from '../../../services/RankService';
import { SupabaseService } from '../../../services/SupabaseService';
import { ACHIEVEMENT_BY_ID } from '../../../services/achievementCatalog';

const STAT_COLORS: Record<Stat, string> = {
  discipline:  '#3A66FF',
  focus:       '#00C2FF',
  execution:   '#00D68F',
  consistency: '#FFC857',
  social:      '#A855F7',
};

const STAT_ROWS: { key: Stat; label: string }[] = [
  { key: 'discipline',  label: 'DISCIPLINE'  },
  { key: 'focus',       label: 'FOCUS'       },
  { key: 'execution',   label: 'EXECUTION'   },
  { key: 'consistency', label: 'CONSISTENCY' },
  { key: 'social',      label: 'SOCIAL'      },
];

const SystemStatsCard: React.FC = () => {
  const [stats, setStats] = useState<UserStatsRow | null>(StatsService.getCached());
  const [achievementIds, setAchievementIds] = useState<string[]>([]);
  const [barAnims] = useState(() => STAT_ROWS.map(() => new Animated.Value(0)));

  useEffect(() => {
    void StatsService.refresh();
    return StatsService.subscribe(setStats);
  }, []);

  // Fetch the 5 most recent achievements once stats are present.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = SupabaseService.getClient();
      const userId = SupabaseService.getCurrentUserId();
      if (!client || !userId) return;
      const { data, error } = await client
        .from('user_achievements')
        .select('achievement_id, earned_at')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false })
        .limit(5);
      if (cancelled) return;
      if (error) {
        console.warn('[SystemStatsCard] achievements fetch failed:', error.message);
        return;
      }
      setAchievementIds(
        (data ?? []).map((r: { achievement_id: string }) => r.achievement_id),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [stats?.user_id]);

  // Animate stat bars whenever values change.
  useEffect(() => {
    STAT_ROWS.forEach((row, idx) => {
      const value = stats?.[row.key] ?? 1;
      Animated.timing(barAnims[idx], {
        toValue: value / 99,
        duration: 800,
        delay: idx * 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [stats, barAnims]);

  const ovr = stats?.ovr ?? 1;
  const totalXp = stats?.total_xp ?? 0;
  const streakDays = stats?.current_streak_days ?? 0;
  const rank = RankService.rankFromStreak(streakDays);

  return (
    <View style={styles.card}>
      {/* Glow orb in rank color */}
      <View
        style={[styles.glowOrb, { backgroundColor: `${rank.color}10` }]}
        pointerEvents="none"
      />

      <Text style={styles.heading}>SYSTEM STATS</Text>

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.ovrLabel}>OVR</Text>
          <Text style={styles.ovrValue}>{ovr}</Text>
        </View>
        <View
          style={[
            styles.rankPill,
            {
              backgroundColor: `${rank.color}1A`,
              borderColor: `${rank.color}55`,
              shadowColor: rank.color,
            },
          ]}
        >
          <Text style={[styles.rankPillText, { color: rank.color }]}>
            {rank.name}
          </Text>
        </View>
      </View>

      <View style={styles.statBlock}>
        {STAT_ROWS.map((row, idx) => {
          const value = stats?.[row.key] ?? 1;
          return (
            <View key={row.key} style={styles.statRow}>
              <Text style={styles.statLabel}>{row.label}</Text>
              <View style={styles.statBarTrack}>
                <Animated.View
                  style={[
                    styles.statBarFill,
                    {
                      backgroundColor: STAT_COLORS[row.key],
                      width: barAnims[idx].interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.statValue}>{value}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.divider} />

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          <Text style={styles.metaTextLabel}>Total XP: </Text>
          <Text style={styles.metaTextValue}>{totalXp.toLocaleString()}</Text>
        </Text>
        <Text style={styles.metaText}>
          <Text style={styles.metaTextLabel}>Streak: </Text>
          <Text style={styles.metaTextValue}>
            {streakDays} {streakDays === 1 ? 'day' : 'days'}
          </Text>
        </Text>
      </View>

      {achievementIds.length > 0 ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.subHeading}>RECENT ACHIEVEMENTS</Text>
          <View style={styles.achievementsRow}>
            {achievementIds.map((id) => {
              const a = ACHIEVEMENT_BY_ID[id];
              if (!a) return null;
              return (
                <View key={id} style={styles.achievementBadge}>
                  <Ionicons
                    name="trophy"
                    size={12}
                    color={Colors.warning}
                  />
                  <Text style={styles.achievementText} numberOfLines={1}>
                    {a.name}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'rgba(21,26,33,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 18,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  heading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ovrLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textMuted,
  },
  ovrValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 44,
    lineHeight: 48,
    color: Colors.textPrimary,
  },
  rankPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  rankPillText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 14,
    letterSpacing: 1.2,
  },
  statBlock: {
    marginTop: 16,
    gap: 10,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statLabel: {
    width: 96,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: Colors.textSecondary,
  },
  statBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statValue: {
    width: 28,
    textAlign: 'right',
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  divider: {
    marginTop: 16,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  metaRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
  },
  metaTextLabel: {
    color: Colors.textMuted,
  },
  metaTextValue: {
    color: Colors.textPrimary,
    fontFamily: FontFamily.headingSemiBold,
  },
  subHeading: {
    marginTop: 14,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  achievementsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,200,87,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,87,0.25)',
  },
  achievementText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    color: Colors.warning,
    maxWidth: 120,
  },
});

export default SystemStatsCard;
