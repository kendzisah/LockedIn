/**
 * ProgramCompleteScreen — Shown once when user completes all 90 days.
 *
 * Displays lifetime stats, encourages continued consistency,
 * and returns the user to the normal app flow (no program bar).
 */

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { useSession } from './state/SessionProvider';
import {
  computeCommitmentPercent,
  dayKeyDelta,
  getTodayKey,
} from './engine/SessionEngine';
import { MixpanelService } from '../../services/MixpanelService';
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';

type Props = NativeStackScreenProps<MainStackParamList, 'ProgramComplete'>;

const ProgramCompleteScreen: React.FC<Props> = ({ navigation }) => {
  const { state } = useSession();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const statsSlide = useRef(new Animated.Value(30)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const messageOpacity = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;

  const calendarDays = useMemo(() => {
    if (!state.programStartDate) return 90;
    return dayKeyDelta(state.programStartDate, getTodayKey()) + 1;
  }, [state.programStartDate]);

  const commitment = useMemo(
    () =>
      computeCommitmentPercent(
        state.maxCompletedDay,
        state.programStartDate,
        state.lastLockInCompletedDate,
      ),
    [state.maxCompletedDay, state.programStartDate, state.lastLockInCompletedDate],
  );

  const totalHours = Math.floor(state.lifetimeTotalMinutes / 60);
  const totalMinutes = state.lifetimeTotalMinutes % 60;

  useEffect(() => {
    MixpanelService.track('Program Completed', {
      calendar_days: calendarDays,
      longest_streak: state.lifetimeLongestStreak,
      total_minutes: state.lifetimeTotalMinutes,
      commitment_percent: commitment,
    });
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(statsOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(statsSlide, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(messageOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(actionsOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeIn, statsOpacity, statsSlide, messageOpacity, actionsOpacity]);

  const handleContinue = useCallback(() => {
    navigation.replace('Home');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.headerSection, { opacity: fadeIn }]}>
          <Text style={styles.congratsLabel}>PROGRAM COMPLETE</Text>
          <Text style={styles.headline}>90 Days. Locked In.</Text>
          <Text style={styles.subheadline}>
            You did what most never will. This is proof of who you are becoming.
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.statsSection,
            {
              opacity: statsOpacity,
              transform: [{ translateY: statsSlide }],
            },
          ]}
        >
          <View style={styles.statsGrid}>
            <StatCard label="Program Days" value="90 / 90" />
            <StatCard label="Calendar Days" value={`${calendarDays}`} />
            <StatCard label="Longest Streak" value={`${state.lifetimeLongestStreak}`} />
            <StatCard
              label="Total Focus Time"
              value={totalHours > 0 ? `${totalHours}h ${totalMinutes}m` : `${totalMinutes}m`}
            />
            <StatCard label="Commitment" value={`${commitment}%`} />
            <StatCard label="Execution Blocks" value={`${state.lifetimeExecutionBlocks}`} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.messageSection, { opacity: messageOpacity }]}>
          <Text style={styles.messageText}>
            The program is complete, but the standard remains.
          </Text>
          <Text style={styles.messageSubtext}>
            Keep locking in daily to maintain your streak and track your progress. Consistency is the only metric that matters now.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.actionsSection, { opacity: actionsOpacity }]}>
          <TouchableOpacity
            onPress={handleContinue}
            style={styles.primaryButton}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

interface StatCardProps {
  label: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value }) => (
  <View style={styles.statCard}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  congratsLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 2,
    marginBottom: 12,
  },
  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    color: Colors.textPrimary,
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: 12,
  },
  subheadline: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  statsSection: {
    marginBottom: 28,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  statValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  messageSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  messageText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  messageSubtext: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionsSection: {
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  primaryButtonText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
  },
});

export default ProgramCompleteScreen;
