/**
 * DayOfWeekRow — S M T W T F S with streak/completion indicators.
 *
 * Current day: underline glow (accent color).
 * Completed (this week): filled dot below letter.
 * Missed (this week): hollow dot.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '../state/SessionProvider';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Get the start of the current week (Sunday) as day keys */
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
  const completedSet = useMemo(
    () => new Set(state.completedDayKeys),
    [state.completedDayKeys],
  );

  return (
    <View style={styles.container}>
      {DAY_LABELS.map((label, index) => {
        const isToday = index === today;
        const isPast = index < today;
        const dayKey = weekDayKeys[index];
        const isCompleted = completedSet.has(dayKey);
        const isMissed = isPast && !isCompleted && state.startDayKey !== null;

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
            {/* Dot indicators */}
            {!isToday && isCompleted && <View style={styles.completedDot} />}
            {!isToday && isMissed && <View style={styles.missedDot} />}
            {!isToday && !isCompleted && !isMissed && (
              <View style={styles.emptyDot} />
            )}
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
  missedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    backgroundColor: 'transparent',
  },
  emptyDot: {
    width: 5,
    height: 5,
    // Invisible placeholder for alignment
  },
});

export default React.memo(DayOfWeekRow);
