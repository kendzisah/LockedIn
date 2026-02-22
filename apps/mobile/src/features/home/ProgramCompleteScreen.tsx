/**
 * ProgramCompleteScreen — Shown when user completes all 90 days.
 *
 * Displays lifetime stats and program summary.
 * Offers "Restart Program" (resets current run, preserves lifetime stats)
 * and "Explore More" (placeholder for future content).
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
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';

type Props = NativeStackScreenProps<MainStackParamList, 'ProgramComplete'>;

const ProgramCompleteScreen: React.FC<Props> = ({ navigation }) => {
  const { state, dispatch } = useSession();

  // ── Animated values ──
  const fadeIn = useRef(new Animated.Value(0)).current;
  const statsSlide = useRef(new Animated.Value(30)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;

  // ── Stats ──
  const calendarDays = useMemo(() => {
    if (!state.programStartDate) return 90;
    return dayKeyDelta(state.programStartDate, getTodayKey()) + 1;
  }, [state.programStartDate]);

  const commitment = useMemo(
    () => computeCommitmentPercent(state.maxCompletedDay, state.programStartDate),
    [state.maxCompletedDay, state.programStartDate],
  );

  const totalHours = Math.floor(state.lifetimeTotalMinutes / 60);
  const totalMinutes = state.lifetimeTotalMinutes % 60;

  // ── Entry animation ──
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
      Animated.timing(actionsOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeIn, statsOpacity, statsSlide, actionsOpacity]);

  // ── Actions ──
  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESET_PROGRAM' });
    navigation.replace('Home');
  }, [dispatch, navigation]);

  const handleExplore = useCallback(() => {
    // Placeholder — for now, just restart
    dispatch({ type: 'RESET_PROGRAM' });
    navigation.replace('Home');
  }, [dispatch, navigation]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View style={[styles.headerSection, { opacity: fadeIn }]}>
          <Text style={styles.congratsLabel}>PROGRAM COMPLETE</Text>
          <Text style={styles.headline}>90 Days. Locked In.</Text>
          <Text style={styles.subheadline}>
            You did what most never will. This is proof of who you are becoming.
          </Text>
        </Animated.View>

        {/* Stats Grid */}
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
              label="Total Listening"
              value={totalHours > 0 ? `${totalHours}h ${totalMinutes}m` : `${totalMinutes}m`}
            />
            <StatCard label="Commitment" value={`${commitment}%`} />
            <StatCard label="Programs Completed" value={`${state.lifetimeRunsCompleted + 1}`} />
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[styles.actionsSection, { opacity: actionsOpacity }]}>
          <TouchableOpacity
            onPress={handleRestart}
            style={styles.primaryButton}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>Restart Program</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExplore}
            style={styles.secondaryButton}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Explore More</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

// ── Stat Card Component ──

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
    marginBottom: 40,
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
    marginBottom: 40,
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
  actionsSection: {
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 6,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
});

export default ProgramCompleteScreen;
