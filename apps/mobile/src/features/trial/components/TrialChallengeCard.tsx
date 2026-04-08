import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

export interface TrialChallengeCardProps {
  isActive: boolean;
  currentDay: 1 | 2 | 3;
  day1Complete: boolean;
  day2FocusComplete: boolean;
  day2MissionsComplete: boolean;
  day3Complete: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
}

export const TrialChallengeCard: React.FC<TrialChallengeCardProps> = ({
  isActive,
  currentDay,
  day1Complete,
  day2FocusComplete,
  day2MissionsComplete,
  day3Complete,
  hoursRemaining,
  minutesRemaining,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulsing animation for the current day circle
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  if (!isActive) {
    return null;
  }

  const getDayCircleStyle = (day: 1 | 2 | 3): ViewStyle => {
    const isCompleted =
      (day === 1 && day1Complete) ||
      (day === 2 && day2FocusComplete && day2MissionsComplete) ||
      (day === 3 && day3Complete);

    const isCurrent = day === currentDay;

    if (isCompleted) {
      return {
        backgroundColor: Colors.accent,
        borderColor: Colors.accent,
      };
    } else if (isCurrent) {
      return {
        backgroundColor: 'transparent',
        borderColor: Colors.accent,
        borderWidth: 2,
      };
    } else {
      return {
        backgroundColor: 'transparent',
        borderColor: Colors.textMuted,
        borderWidth: 2,
      };
    }
  };

  const getDayTextColor = (day: 1 | 2 | 3): string => {
    const isCompleted =
      (day === 1 && day1Complete) ||
      (day === 2 && day2FocusComplete && day2MissionsComplete) ||
      (day === 3 && day3Complete);

    const isCurrent = day === currentDay;

    if (isCompleted) {
      return Colors.background;
    } else if (isCurrent) {
      return Colors.accent;
    } else {
      return Colors.textMuted;
    }
  };

  const getTodaysTasks = () => {
    switch (currentDay) {
      case 1:
        return [
          { label: 'Complete your first Lock In session', done: day1Complete },
        ];
      case 2:
        return [
          { label: "Beat yesterday's focus time", done: day2FocusComplete },
          { label: 'Complete 2 missions', done: day2MissionsComplete },
        ];
      case 3:
        return [
          { label: 'See your first Discipline Report', done: day3Complete },
        ];
    }
  };

  const tasks = getTodaysTasks();

  return (
    <View style={styles.card}>
      {/* Header */}
      <Text style={styles.header}>3-Day Discipline Challenge</Text>

      {/* Day Circles */}
      <View style={styles.daysContainer}>
        {([1, 2, 3] as const).map((day) => {
          const isCompleted =
            (day === 1 && day1Complete) ||
            (day === 2 && day2FocusComplete && day2MissionsComplete) ||
            (day === 3 && day3Complete);

          const isCurrent = day === currentDay;

          return (
            <Animated.View
              key={day}
              style={[
                styles.dayCircleWrapper,
                isCurrent && { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <View style={[styles.dayCircle, getDayCircleStyle(day)]}>
                {isCompleted ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : (
                  <Text style={[styles.dayNumber, { color: getDayTextColor(day) }]}>
                    {day}
                  </Text>
                )}
              </View>
              <Text style={styles.dayLabel}>Day {day}</Text>
            </Animated.View>
          );
        })}
      </View>

      {/* Today's Tasks */}
      <View style={styles.tasksContainer}>
        {tasks.map((task, index) => (
          <View key={index} style={styles.taskRow}>
            <View
              style={[
                styles.checkbox,
                task.done && styles.checkboxDone,
              ]}
            >
              {task.done && <Text style={styles.checkmarkSmall}>✓</Text>}
            </View>
            <Text
              style={[
                styles.taskLabel,
                task.done && styles.taskLabelDone,
              ]}
            >
              {task.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Trial Expiry */}
      <View style={styles.expiryContainer}>
        <Text style={styles.expiryText}>
          Trial ends in {hoursRemaining}h {minutesRemaining}m
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  header: {
    fontSize: 18,
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.accent,
    marginBottom: 20,
    textAlign: 'center',
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 24,
  },
  dayCircleWrapper: {
    alignItems: 'center',
  },
  dayCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayNumber: {
    fontSize: 20,
    fontFamily: FontFamily.headingSemiBold,
  },
  checkmark: {
    fontSize: 24,
    color: Colors.background,
  },
  dayLabel: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  tasksContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskRowLast: {
    marginBottom: 0,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxDone: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkmarkSmall: {
    fontSize: 12,
    color: Colors.background,
    fontFamily: FontFamily.headingSemiBold,
  },
  taskLabel: {
    fontSize: 14,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    flex: 1,
  },
  taskLabelDone: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  expiryContainer: {
    alignItems: 'center',
  },
  expiryText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.textMuted,
  },
});
