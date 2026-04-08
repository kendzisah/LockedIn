/**
 * DayDots — M T W T F S S with glassmorphic states.
 *
 * Completed (past or today): Blue fill + white checkmark
 * Missed (past, not completed): Red fill + white X
 * Today (not yet completed): Cyan accent border
 * Future: Dimmed empty
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../state/SessionProvider';
import { getTodayKey } from '../engine/SessionEngine';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

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

const DayDots: React.FC = () => {
  const { state } = useSession();
  const todayKey = useMemo(() => getTodayKey(), []);
  const weekKeys = useMemo(() => getCurrentWeekDayKeys(), []);

  const completedSet = useMemo(() => {
    const s = new Set<string>();
    const week = new Set(weekKeys);
    // Use persisted weekly completion history
    for (const dk of state.weekCompletedDays ?? []) {
      if (week.has(dk)) s.add(dk);
    }
    // Also include recent dates for backwards compat
    if (state.lastLockInCompletedDate && week.has(state.lastLockInCompletedDate)) {
      s.add(state.lastLockInCompletedDate);
    }
    if (state.lastSessionDayKey && week.has(state.lastSessionDayKey)) {
      s.add(state.lastSessionDayKey);
    }
    return s;
  }, [state.weekCompletedDays, state.lastLockInCompletedDate, state.lastSessionDayKey, weekKeys]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
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
                  styles.label,
                  isToday && styles.labelToday,
                  isCompleted && styles.labelCompleted,
                  isMissed && styles.labelMissed,
                ]}
              >
                {label}
              </Text>
              <View
                style={[
                  styles.dot,
                  isCompleted && styles.dotCompleted,
                  isMissed && styles.dotMissed,
                  isToday && !isCompleted && styles.dotToday,
                  isFuture && styles.dotFuture,
                ]}
              >
                {isCompleted && (
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                )}
                {isMissed && (
                  <Ionicons name="close" size={14} color={Colors.danger} />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  labelToday: {
    color: Colors.accent,
    fontFamily: FontFamily.bodyMedium,
  },
  labelCompleted: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
  },
  labelMissed: {
    color: Colors.danger,
    fontFamily: FontFamily.bodyMedium,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(44,52,64,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCompleted: {
    backgroundColor: Colors.primary,
    borderColor: 'rgba(58,102,255,0.4)',
  },
  dotMissed: {
    backgroundColor: 'rgba(255,71,87,0.06)',
    borderColor: 'rgba(255,71,87,0.45)',
    borderWidth: 1.5,
  },
  dotToday: {
    borderColor: Colors.accent,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,194,255,0.06)',
  },
  dotFuture: {
    borderColor: 'rgba(255,255,255,0.03)',
    opacity: 0.4,
  },
});

export default React.memo(DayDots);
