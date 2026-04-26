/**
 * MissionsTab — HUD mission log. Wraps every section in HUDPanel:
 * daily missions (3-slot), goal-specific daily activity check-in, stat
 * growth aggregation, and mission history.
 */

import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useMissions } from '../MissionsProvider';
import { useSession } from '../../home/state/SessionProvider';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { NotificationService } from '../../../services/NotificationService';
import AppGuideSheet, { useAppGuide } from '../../../design/components/AppGuideSheet';
import HUDPanel from '../../home/components/HUDPanel';
import MissionLogCard from '../components/MissionLogCard';
import DailyActivityCard from '../components/DailyActivityCard';
import StatGrowthPanel from '../components/StatGrowthPanel';
import MissionHistoryPanel from '../components/MissionHistoryPanel';
import { SystemTokens } from '../../home/systemTokens';

const MissionsTab: React.FC = () => {
  const {
    missions,
    weeklyMissions,
    completedCount,
    totalXP,
    completeMission,
    lockedInToday,
  } = useMissions();
  const { state: session } = useSession();
  const streak = session.consecutiveStreak;

  useEffect(() => {
    if (lockedInToday) {
      void NotificationService.cancelMissionReminder();
    }
  }, [lockedInToday]);

  const missionsGuide = useAppGuide('missions');
  const allDone = missions.length > 0 && completedCount === missions.length;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0A1628', '#0E1116', '#0E1116']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowOrb} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <HUDPanel headerLabel="MISSION LOG" headerRight={`Day ${streak}`} />

          <HUDPanel
            headerLabel="DAILY MISSIONS"
            headerRight={`${completedCount}/${missions.length}`}
          >
            <View style={styles.list}>
              {missions.map((m) => (
                <MissionLogCard key={m.id} mission={m} onComplete={completeMission} />
              ))}
            </View>
            <View style={styles.bonusRow}>
              <Text
                style={[
                  styles.bonusText,
                  allDone && {
                    textShadowColor: SystemTokens.gold,
                    textShadowRadius: 8,
                    textShadowOffset: { width: 0, height: 0 },
                  },
                ]}
              >
                {allDone ? '✦ ALL MISSIONS CLEAR  —  +50 XP' : 'COMPLETE ALL  —  +50 XP BONUS'}
              </Text>
            </View>
          </HUDPanel>

          <DailyActivityCard />

          <StatGrowthPanel missions={missions} />

          {weeklyMissions.length > 0 && (
            <HUDPanel
              headerLabel="WEEKLY CHALLENGES"
              headerRight={`${weeklyMissions.filter((w) => w.completed).length}/${weeklyMissions.length}`}
            >
              <View style={styles.list}>
                {weeklyMissions.map((m) => (
                  <MissionLogCard key={m.id} mission={m} onComplete={completeMission} />
                ))}
              </View>
            </HUDPanel>
          )}

          <MissionHistoryPanel
            completedToday={completedCount}
            totalToday={missions.length}
            seasonXp={totalXP}
          />
        </ScrollView>
      </SafeAreaView>

      <AppGuideSheet
        {...missionsGuide}
        title="Your Mission Log"
        subtitle="Daily missions + a signature check-in based on your goal."
        tips={[
          {
            icon: 'flash-outline',
            iconColor: Colors.accent,
            text: 'Daily missions are personalized — tap one to mark it complete and collect XP.',
          },
          {
            icon: 'shield-outline',
            iconColor: Colors.primary,
            text: 'Your daily activity check-in is your signature ritual — same XP every day across every goal.',
          },
          {
            icon: 'analytics-outline',
            iconColor: Colors.success,
            text: 'The stat growth panel shows which stats your missions target and which one is weakest right now.',
          },
          {
            icon: 'calendar-outline',
            iconColor: '#FFC857',
            text: 'Weekly challenges and your lifetime totals live below.',
          },
        ]}
      />
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
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(58,102,255,0.06)',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scroll: {
    paddingTop: 12,
    paddingBottom: 140,
    gap: 12,
  },
  list: {
    gap: 8,
  },
  bonusRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SystemTokens.divider,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  bonusText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: SystemTokens.gold,
  },
});

export default MissionsTab;
