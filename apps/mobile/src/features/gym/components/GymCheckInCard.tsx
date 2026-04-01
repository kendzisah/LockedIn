import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import Colors from '../../../constants/Colors';
import FontFamily from '../../../constants/FontFamily';
import GymCheckInService from '../GymCheckInService';

interface GymCheckInCardProps {
  showGym: boolean; // Only show if user's primary_goal is "Improve my physique"
  onCheckInChange?: (isCheckedIn: boolean) => void;
}

const GymCheckInCard: React.FC<GymCheckInCardProps> = ({ showGym, onCheckInChange }) => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [weekCheckins, setWeekCheckins] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [checkedIn, count, currentStreak, weekCheckIns] = await Promise.all([
        GymCheckInService.isCheckedInToday(),
        GymCheckInService.getWeeklyCount(),
        GymCheckInService.getStreak(),
        GymCheckInService.getWeekCheckIns(),
      ]);

      setIsCheckedIn(checkedIn);
      setWeeklyCount(count);
      setStreak(currentStreak);
      setWeekCheckins(weekCheckIns);
    } catch (error) {
      console.error('[GymCheckInCard] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await GymCheckInService.checkIn();

      const newIsCheckedIn = !isCheckedIn;
      setIsCheckedIn(newIsCheckedIn);

      const newCount = newIsCheckedIn
        ? weeklyCount + 1
        : Math.max(0, weeklyCount - 1);
      setWeeklyCount(newCount);

      const newWeekCheckins = await GymCheckInService.getWeekCheckIns();
      setWeekCheckins(newWeekCheckins);

      const newStreak = await GymCheckInService.getStreak();
      setStreak(newStreak);

      onCheckInChange?.(newIsCheckedIn);

      if (newIsCheckedIn) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[GymCheckInCard] Error handling check-in:', error);
    }
  };

  if (!showGym || loading) {
    return null;
  }

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <View style={[styles.card, { backgroundColor: Colors.backgroundSecondary }]}>
      {/* Header */}
      <Text style={styles.title}>Did you train today?</Text>

      {/* Large Check-In Circle */}
      <TouchableOpacity
        style={styles.checkInButtonContainer}
        onPress={handleCheckIn}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkInCircle,
            isCheckedIn && {
              backgroundColor: Colors.accent,
              borderColor: Colors.accent,
            },
          ]}
        >
          {isCheckedIn && (
            <MaterialIcons
              name="fitness-center"
              size={32}
              color={Colors.background}
            />
          )}
        </View>
      </TouchableOpacity>

      <Text style={styles.checkInPrompt}>
        {isCheckedIn ? 'Great work!' : 'Tap to check in'}
      </Text>

      {/* Weekly Check-In Dots */}
      <View style={styles.weekContainer}>
        <View style={styles.dotGrid}>
          {weekCheckins.map((checked, index) => (
            <View key={index} style={styles.dayColumn}>
              <View
                style={[
                  styles.dot,
                  checked && { backgroundColor: Colors.accent },
                ]}
              />
              <Text style={styles.dayLabel}>{dayLabels[index]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Weekly Counter */}
      <Text style={styles.weeklyCounter}>
        <Text style={styles.weeklyCountValue}>{weeklyCount}</Text>
        <Text style={styles.weeklyCountLabel}>/7 this week</Text>
      </Text>

      {/* Streak (if > 0) */}
      {streak > 0 && (
        <View style={styles.streakContainer}>
          <MaterialIcons
            name="local-fire-department"
            size={16}
            color={Colors.success}
          />
          <Text style={[styles.streakText, { color: Colors.success }]}>
            {streak} day streak!
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  checkInButtonContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  checkInCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInPrompt: {
    fontSize: 14,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  weekContainer: {
    marginBottom: 16,
  },
  dotGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  dayColumn: {
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.surface,
  },
  dayLabel: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  weeklyCounter: {
    fontSize: 14,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  weeklyCountValue: {
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  weeklyCountLabel: {
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  streakText: {
    fontSize: 13,
    fontFamily: FontFamily.headingSemiBold,
  },
});

export default GymCheckInCard;
