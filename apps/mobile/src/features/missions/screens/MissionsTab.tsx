/**
 * MissionsTab — The Quest Log with 3-slot mission system and glassmorphic design.
 */

import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMissions } from '../MissionsProvider';
import { MissionCard } from '../components/MissionCard';
import { useOnboarding } from '../../onboarding/state/OnboardingProvider';
import GymCheckInCard from '../../gym/components/GymCheckInCard';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { NotificationService } from '../../../services/NotificationService';

const XP_LEVELS = [
  { name: 'Apprentice', threshold: 0 },
  { name: 'Warrior', threshold: 200 },
  { name: 'Gladiator', threshold: 500 },
  { name: 'Elite', threshold: 1000 },
  { name: 'Legend', threshold: 2000 },
];

function getLevelInfo(xp: number) {
  let current = XP_LEVELS[0];
  let next: typeof current | null = XP_LEVELS[1];
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].threshold) {
      current = XP_LEVELS[i];
      next = XP_LEVELS[i + 1] ?? null;
      break;
    }
  }
  const nextThreshold = next ? next.threshold : current.threshold + 1000;
  const progress = (xp - current.threshold) / (nextThreshold - current.threshold);
  return { level: current.name, xp, nextThreshold, progress: Math.min(1, progress) };
}

const LEVEL_COLORS: Record<string, string> = {
  Apprentice: Colors.accent,
  Warrior: Colors.primary,
  Gladiator: '#FFC857',
  Elite: '#B0A0FF',
  Legend: '#FF6B35',
};

const MissionsTab: React.FC = () => {
  const { missions, completedCount, dailyXP, totalXP, completeMission, lockedInToday } =
    useMissions();

  useEffect(() => {
    if (lockedInToday) {
      void NotificationService.cancelMissionReminder();
    }
  }, [lockedInToday]);
  const { state: onboardingState } = useOnboarding();
  const showGymCard = onboardingState.primaryGoal === 'Improve my physique';

  const level = getLevelInfo(totalXP);
  const accentColor = LEVEL_COLORS[level.level] ?? Colors.accent;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0E1116', '#111922', '#0E1116']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowOrb} />
      <View style={styles.glowOrb2} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Header */}
          <Text style={styles.heading}>Daily Missions</Text>
          <Text style={styles.subheading}>
            Complete missions to earn XP and rank up
          </Text>

          {/* XP Progress Card */}
          <View style={styles.xpCard}>
            <View style={[styles.xpCardGlow, { backgroundColor: `${accentColor}08` }]} />
            <View style={styles.xpHeader}>
              <View style={[styles.levelBadge, { backgroundColor: `${accentColor}15` }]}>
                <Ionicons name="shield" size={14} color={accentColor} />
                <Text style={[styles.levelName, { color: accentColor }]}>
                  {level.level}
                </Text>
              </View>
              <Text style={styles.xpCount}>
                <Text style={styles.xpCountBold}>{totalXP}</Text>
                {' / '}{level.nextThreshold} XP
              </Text>
            </View>

            <View style={styles.xpTrack}>
              <LinearGradient
                colors={[accentColor, Colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.xpFill, { width: `${Math.max(level.progress * 100, 2)}%` }]}
              />
              {level.progress > 0.05 && (
                <View
                  style={[
                    styles.xpFillGlow,
                    {
                      left: `${level.progress * 100 - 2}%`,
                      backgroundColor: accentColor,
                    },
                  ]}
                />
              )}
            </View>

            {/* Daily XP earned today */}
            {dailyXP > 0 && (
              <Text style={styles.dailyXPNote}>+{dailyXP} XP earned today</Text>
            )}
          </View>

          {/* Section header */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLeft}>
              <Ionicons name="flash" size={16} color={Colors.accent} />
              <Text style={styles.sectionTitle}>Today's Missions</Text>
            </View>
            <View style={[
              styles.completePill,
              completedCount === missions.length && missions.length > 0 && styles.completePillDone,
            ]}>
              <Text style={[
                styles.completePillText,
                completedCount === missions.length && missions.length > 0 && styles.completePillTextDone,
              ]}>
                {completedCount}/{missions.length} Complete
              </Text>
            </View>
          </View>

          {/* Mission cards */}
          <View style={styles.missionList}>
            {missions.map((m) => (
              <MissionCard key={m.id} mission={m} onComplete={completeMission} />
            ))}
          </View>

          {/* Gym check-in bonus */}
          {showGymCard && (
            <>
              <View style={styles.bonusDivider}>
                <View style={styles.dividerLine} />
                <View style={styles.bonusBadge}>
                  <Ionicons name="star" size={10} color={Colors.accent} />
                  <Text style={styles.bonusLabel}>BONUS</Text>
                </View>
                <View style={styles.dividerLine} />
              </View>
              <GymCheckInCard showGym={showGymCard} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  glowOrb: {
    position: 'absolute',
    top: 30,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(58,102,255,0.04)',
  },
  glowOrb2: {
    position: 'absolute',
    top: 300,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(0,194,255,0.03)',
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  heading: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: 8,
  },
  subheading: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
    marginBottom: 24,
  },

  /* XP Card */
  xpCard: {
    backgroundColor: 'rgba(21,26,33,0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 18,
    marginBottom: 28,
    overflow: 'hidden',
  },
  xpCardGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  levelName: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
  },
  xpCount: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  xpCountBold: {
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textSecondary,
  },
  xpTrack: {
    height: 8,
    backgroundColor: 'rgba(44,52,64,0.5)',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  xpFill: {
    height: '100%',
    borderRadius: 4,
  },
  xpFillGlow: {
    position: 'absolute',
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    opacity: 0.4,
  },
  dailyXPNote: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.success,
    textAlign: 'right',
    marginTop: 8,
  },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  completePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(44,52,64,0.4)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  completePillDone: {
    backgroundColor: 'rgba(0,214,143,0.1)',
    borderColor: 'rgba(0,214,143,0.15)',
  },
  completePillText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.accent,
  },
  completePillTextDone: {
    color: Colors.success,
  },

  /* Mission list */
  missionList: {
    gap: 10,
  },

  /* Bonus divider */
  bonusDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,194,255,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,194,255,0.1)',
  },
  bonusLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    color: Colors.accent,
    letterSpacing: 1.2,
  },
});

export default MissionsTab;
