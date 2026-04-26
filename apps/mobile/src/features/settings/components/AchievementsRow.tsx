/**
 * AchievementsRow — Horizontal-scroll achievement badge grid wrapped
 * in a HUDPanel. Earned achievements render in their category color;
 * locked ones render muted. Reads earned IDs from user_achievements.
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HUDPanel from '../../home/components/HUDPanel';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';
import { SupabaseService } from '../../../services/SupabaseService';
import {
  ACHIEVEMENT_CATALOG,
  ACHIEVEMENT_BY_ID,
  type Achievement,
} from '../../../services/achievementCatalog';

const CATEGORY_COLOR: Record<Achievement['category'], string> = {
  session:  SystemTokens.cyan,
  streak:   SystemTokens.gold,
  mission:  SystemTokens.green,
  stat:     SystemTokens.glowAccent,
  social:   SystemTokens.purple,
};

const AchievementsRow: React.FC = () => {
  const [earned, setEarned] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = SupabaseService.getClient();
      const userId = SupabaseService.getCurrentUserId();
      if (!client || !userId) return;
      const { data, error } = await client
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId);
      if (cancelled || error) return;
      const ids = new Set<string>(
        (data ?? []).map((r: { achievement_id: string }) => r.achievement_id),
      );
      setEarned(ids);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = ACHIEVEMENT_CATALOG.length;
  const earnedCount = earned.size;

  // Show earned first, then locked
  const ordered = [
    ...ACHIEVEMENT_CATALOG.filter((a) => earned.has(a.id)),
    ...ACHIEVEMENT_CATALOG.filter((a) => !earned.has(a.id)),
  ];

  return (
    <HUDPanel
      headerLabel="ACHIEVEMENTS"
      headerRight={`${earnedCount}/${total}`}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {ordered.map((a) => {
          const isEarned = earned.has(a.id);
          const color = isEarned ? CATEGORY_COLOR[a.category] : SystemTokens.textMuted;
          const meta = ACHIEVEMENT_BY_ID[a.id];
          return (
            <View key={a.id} style={styles.cell}>
              <View
                style={[
                  styles.badge,
                  isEarned
                    ? {
                        borderColor: color,
                        backgroundColor: `${color}1A`,
                        shadowColor: color,
                      }
                    : styles.badgeLocked,
                ]}
              >
                <Ionicons
                  name={isEarned ? 'trophy' : 'lock-closed'}
                  size={18}
                  color={color}
                />
              </View>
              <Text
                style={[
                  styles.name,
                  { color: isEarned ? SystemTokens.textPrimary : SystemTokens.textMuted },
                ]}
                numberOfLines={1}
              >
                {meta?.name ?? a.name}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </HUDPanel>
  );
};

const styles = StyleSheet.create({
  row: {
    gap: 12,
    paddingVertical: 4,
  },
  cell: {
    width: 64,
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  badgeLocked: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  name: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 9,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});

export default React.memo(AchievementsRow);
