/**
 * MissionsPanel.tsx
 * Panel showing all 3 daily missions with completion counter and LOCKED IN badge
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useMissions } from '../MissionsProvider';
import { MissionCard } from './MissionCard';
import { NotificationService } from '../../../services/NotificationService';

interface MissionsPanelProps {
  showScrollView?: boolean;
}

export const MissionsPanel: React.FC<MissionsPanelProps> = ({ showScrollView = false }) => {
  const { missions, completedCount, totalXP, lockedInToday, completeMission } = useMissions();

  useEffect(() => {
    if (lockedInToday) {
      void NotificationService.cancelMissionReminder();
    }
  }, [lockedInToday]);

  const PanelContent = () => (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Daily Missions</Text>
          {lockedInToday && <Text style={styles.flameIcon}>🔥</Text>}
        </View>

        {/* Counter */}
        <View style={styles.counter}>
          <Text style={styles.counterText}>{completedCount}/3 Complete</Text>
        </View>
      </View>

      {/* Missions List */}
      <View style={styles.missionsContainer}>
        {missions.map(mission => (
          <MissionCard
            key={mission.id}
            mission={mission}
            onComplete={completeMission}
          />
        ))}
      </View>

      {/* Stats and Badge Row */}
      <View style={styles.footerContainer}>
        {/* XP Counter */}
        <View style={styles.xpCounter}>
          <Text style={styles.xpValue}>{totalXP}</Text>
          <Text style={styles.xpLabel}>XP Earned</Text>
        </View>

        {/* LOCKED IN Badge */}
        {lockedInToday && (
          <View style={styles.lockedInBadge}>
            <Text style={styles.lockedInText}>LOCKED IN</Text>
            <View style={styles.glowEffect} />
          </View>
        )}
      </View>
    </View>
  );

  if (showScrollView) {
    return (
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <PanelContent />
      </ScrollView>
    );
  }

  return <PanelContent />;
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: FontFamily.heading,
    color: Colors.textPrimary,
  },
  flameIcon: {
    fontSize: 20,
  },
  counter: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
    borderRadius: 6,
  },
  counterText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.accent,
  },
  missionsContainer: {
    marginBottom: 16,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  xpCounter: {
    alignItems: 'center',
  },
  xpValue: {
    fontSize: 18,
    fontFamily: FontFamily.headingBold,
    color: Colors.accent,
  },
  xpLabel: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  lockedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.accent,
    borderRadius: 6,
    position: 'relative',
  },
  lockedInText: {
    fontSize: 12,
    fontFamily: FontFamily.headingBold,
    color: Colors.background,
    letterSpacing: 0.5,
  },
  glowEffect: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: Colors.accent,
    opacity: 0.2,
  },
});
