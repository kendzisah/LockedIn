/**
 * GymCheckInCard — Glassmorphic gym check-in card with weekly dots and streak.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import GymCheckInService from '../GymCheckInService';

interface GymCheckInCardProps {
  showGym: boolean;
  onCheckInChange?: (isCheckedIn: boolean) => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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
      setWeeklyCount(newIsCheckedIn ? weeklyCount + 1 : Math.max(0, weeklyCount - 1));

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

  if (!showGym || loading) return null;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Ionicons name="barbell-outline" size={18} color={Colors.success} />
          </View>
          <View>
            <Text style={styles.title}>Gym Check-In</Text>
            <Text style={styles.subtitle}>Did you train today?</Text>
          </View>
        </View>

        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={12} color={Colors.success} />
            <Text style={styles.streakText}>{streak}d</Text>
          </View>
        )}
      </View>

      {/* Check-in button */}
      <TouchableOpacity
        style={[styles.checkInBtn, isCheckedIn && styles.checkInBtnDone]}
        onPress={handleCheckIn}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isCheckedIn ? 'checkmark-circle' : 'fitness-outline'}
          size={18}
          color={isCheckedIn ? '#FFFFFF' : Colors.success}
        />
        <Text style={[styles.checkInText, isCheckedIn && styles.checkInTextDone]}>
          {isCheckedIn ? 'Checked In!' : 'I Trained Today'}
        </Text>
      </TouchableOpacity>

      {/* Weekly dots */}
      <View style={styles.weekRow}>
        {weekCheckins.map((checked, i) => (
          <View key={i} style={styles.dayCol}>
            <View style={[styles.dot, checked && styles.dotChecked]}>
              {checked && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
            </View>
            <Text style={[styles.dayLabel, checked && styles.dayLabelChecked]}>
              {DAY_LABELS[i]}
            </Text>
          </View>
        ))}
      </View>

      {/* Weekly counter */}
      <View style={styles.counterRow}>
        <Text style={styles.counterValue}>{weeklyCount}</Text>
        <Text style={styles.counterLabel}>/7 this week</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(21,26,33,0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,214,143,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.12)',
  },
  title: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,214,143,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.12)',
  },
  streakText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    color: Colors.success,
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,214,143,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.15)',
    marginBottom: 18,
  },
  checkInBtnDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkInText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.success,
  },
  checkInTextDone: {
    color: '#FFFFFF',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  dayCol: {
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(44,52,64,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotChecked: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  dayLabel: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: Colors.textMuted,
  },
  dayLabelChecked: {
    color: Colors.success,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  counterValue: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 18,
    color: Colors.textPrimary,
  },
  counterLabel: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
});

export default GymCheckInCard;
