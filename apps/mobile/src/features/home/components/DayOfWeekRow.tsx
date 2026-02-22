/**
 * DayOfWeekRow — S M T W T F S with today indicator.
 *
 * Current day: underline glow (accent color).
 * Last completed day (this week): filled dot.
 *
 * Simplified: since we no longer track per-calendar-day completions,
 * we show today's completion status via lastLockInCompletedDate and
 * mark today with the accent indicator.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '../state/SessionProvider';
import { getTodayKey } from '../engine/SessionEngine';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Get the day keys for the current week (Sunday to Saturday) */
function getCurrentWeekDayKeys(): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const keys: string[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - dayOfWeek + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    keys.push(`${year}-${month}-${day}`);
  }

  return keys;
}

const DayOfWeekRow: React.FC = () => {
  const { state } = useSession();
  const today = new Date().getDay(); // 0 = Sunday

  const weekDayKeys = useMemo(() => getCurrentWeekDayKeys(), []);
  const todayKey = useMemo(() => getTodayKey(), []);

  // Determine which days this week had a completed session
  // We only know about today and the last session day
  const completedThisWeek = useMemo(() => {
    const completed = new Set<string>();

    // Today completed?
    if (state.lastLockInCompletedDate) {
      const weekSet = new Set(weekDayKeys);
      if (weekSet.has(state.lastLockInCompletedDate)) {
        completed.add(state.lastLockInCompletedDate);
      }
    }

    // Last session day key (if this week)
    if (state.lastSessionDayKey) {
      const weekSet = new Set(weekDayKeys);
      if (weekSet.has(state.lastSessionDayKey)) {
        completed.add(state.lastSessionDayKey);
      }
    }

    return completed;
  }, [state.lastLockInCompletedDate, state.lastSessionDayKey, weekDayKeys]);

  return (
    <View style={styles.container}>
      {DAY_LABELS.map((label, index) => {
        const isToday = index === today;
        const dayKey = weekDayKeys[index];
        const isCompleted = completedThisWeek.has(dayKey);

        return (
          <View key={index} style={styles.dayColumn}>
            <Text
              style={[
                styles.dayLabel,
                isToday && styles.dayLabelToday,
              ]}
            >
              {label}
            </Text>
            {/* Underline glow for today */}
            {isToday && <View style={styles.todayUnderline} />}
            {/* Completed dot */}
            {!isToday && isCompleted && <View style={styles.completedDot} />}
            {/* Empty placeholder for alignment */}
            {!isToday && !isCompleted && <View style={styles.emptyDot} />}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 16,
  },
  dayColumn: {
    alignItems: 'center',
    width: 24,
  },
  dayLabel: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dayLabelToday: {
    color: Colors.accent,
    fontFamily: FontFamily.bodyMedium,
  },
  todayUnderline: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.accent,
  },
  completedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.accent,
  },
  emptyDot: {
    width: 5,
    height: 5,
    // Invisible placeholder for alignment
  },
});

export default React.memo(DayOfWeekRow);
