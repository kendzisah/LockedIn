/**
 * HomeTab — Focus + Streak. Glassmorphic dark UI with gradient background.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../state/SessionProvider';
import { useOnboarding } from '../../onboarding/state/OnboardingProvider';
import { ClockService } from '../../../services/ClockService';
import { NotificationService } from '../../../services/NotificationService';
import { LockModeService } from '../../../services/LockModeService';
import { Analytics } from '../../../services/AnalyticsService';
import { StreakRecoveryService } from '../../streak/StreakRecoveryService';
import WeeklyReportService from '../../report/WeeklyReportService';
import { ACTIVE_EB_KEY } from '../ExecutionBlockScreen';
import { useMissions } from '../../missions/MissionsProvider';
import { Colors } from '../../../design/colors';
import StreakAtRiskBanner from '../components/StreakAtRiskBanner';
import SystemStatusBar from '../components/SystemStatusBar';
import FocusRing from '../components/FocusRing';
import CompactMissions from '../components/CompactMissions';
import StreakBreakOverlay from '../components/StreakBreakOverlay';
import { RankService } from '../../../services/RankService';
import type { RankId } from '@lockedin/shared-types';
import { StreakRecoveryModal } from '../../streak/components/StreakRecoveryModal';
import { useAuth } from '../../auth/AuthProvider';
import SignUpNudgeSheet from '../../auth/components/SignUpNudgeSheet';
import * as StoreReview from 'expo-store-review';
import AppGuideSheet, { useAppGuide } from '../../../design/components/AppGuideSheet';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

const PENDING_SIGNUP_KEY = '@lockedin/pending_signup';
/** Dedupes AppsFlyer af_tutorial_completion when the home app guide is dismissed. */
const AF_TUTORIAL_HOME_GUIDE_KEY = '@lockedin/af_tutorial_home_guide_sent';
const STORE_REVIEW_SHOWN_KEY = '@lockedin/store_review_after_guide';

const HomeTab: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { state, dispatch, isHydrated } = useSession();
  const { state: onboardingState } = useOnboarding();
  const { lockedInToday } = useMissions();

  useEffect(() => {
    if (lockedInToday) {
      void NotificationService.cancelMissionReminder();
    }
  }, [lockedInToday]);

  const { isAnonymous } = useAuth();
  const homeGuide = useAppGuide('home');

  const onHomeGuideDismiss = useCallback(() => {
    homeGuide.onDismiss();
    void (async () => {
      try {
        if (await AsyncStorage.getItem(AF_TUTORIAL_HOME_GUIDE_KEY)) return;
        Analytics.trackAF('af_tutorial_completion', {
          af_success: '1',
          af_content_id: 'home_guide',
        });
        await AsyncStorage.setItem(AF_TUTORIAL_HOME_GUIDE_KEY, 'true');
      } catch {
        /* ignore */
      }

      // Prompt for App Store review once, right after the first guide dismiss
      try {
        if (await AsyncStorage.getItem(STORE_REVIEW_SHOWN_KEY)) return;
        if (await StoreReview.hasAction()) {
          await StoreReview.requestReview();
        }
        await AsyncStorage.setItem(STORE_REVIEW_SHOWN_KEY, 'true');
      } catch {
        /* StoreReview unavailable */
      }
    })();
  }, [homeGuide.onDismiss]);

  const [tick, setTick] = useState(0);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [canRecover, setCanRecover] = useState(false);
  const [recoveriesRemaining, setRecoveriesRemaining] = useState(0);
  const [showSignUpNudge, setShowSignUpNudge] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') setTick((c) => c + 1);
    });
    return () => sub.remove();
  }, []);

  const todayKey = useMemo(() => ClockService.getLocalDateKey(), [tick]);
  const dailyCommitment = onboardingState.dailyMinutes ?? 60;
  const dailyFocused = useMemo(() => {
    if (state.dailyFocusDate === todayKey) return state.dailyFocusedMinutes;
    return 0;
  }, [state.dailyFocusedMinutes, state.dailyFocusDate, todayKey]);
  const dailyGoalMet = dailyFocused >= dailyCommitment;

  const closeGoalRef = useRef({ dailyFocused, dailyCommitment, dailyGoalMet });
  closeGoalRef.current = { dailyFocused, dailyCommitment, dailyGoalMet };

  useEffect(() => {
    if (dailyGoalMet && state.dailyGoalMetDate !== todayKey) {
      dispatch({ type: 'DAILY_GOAL_MET' });
    }
  }, [dailyGoalMet, state.dailyGoalMetDate, todayKey, dispatch]);

  useEffect(() => {
    if (!isHydrated) return;
    void NotificationService.scheduleAllDailyNotifications(state.consecutiveStreak);
  }, [isHydrated, state.consecutiveStreak]);

  // Streak-break overlay: trigger when consecutiveStreak transitions
  // from > 0 to 0 (the user just lost their streak by missing a day).
  const [streakBreak, setStreakBreak] = useState<null | {
    previousStreakDays: number;
    previousRankId: RankId;
  }>(null);
  const prevHomeStreak = useRef<number | null>(null);
  useEffect(() => {
    if (!isHydrated) return;
    const prev = prevHomeStreak.current;
    const next = state.consecutiveStreak;
    if (prev !== null && prev > 0 && next === 0) {
      const lostRank = RankService.rankFromStreak(prev);
      setStreakBreak({ previousStreakDays: prev, previousRankId: lostRank.id });
    }
    prevHomeStreak.current = next;
  }, [isHydrated, state.consecutiveStreak]);

  // Master scheduler omits close-to-goal; re-arm only when that run happens (streak / hydrate path).
  useEffect(() => {
    if (!isHydrated) return;
    const { dailyFocused: df, dailyCommitment: dc, dailyGoalMet: met } = closeGoalRef.current;
    if (met) return;
    if (df < dc * 0.8 || df >= dc) return;
    void NotificationService.scheduleCloseToGoalNudge(Math.max(1, Math.ceil(dc - df)));
  }, [isHydrated, state.consecutiveStreak]);

  useEffect(() => {
    if (!isHydrated || !dailyGoalMet) return;
    NotificationService.cancelLockInReminders();
    NotificationService.cancelCloseToGoalNudge();
  }, [isHydrated, dailyGoalMet]);

  const prevFocused = useRef(dailyFocused);
  useEffect(() => {
    if (!isHydrated) return;
    const wasBelow = prevFocused.current < dailyCommitment;
    const isCloseNow = dailyFocused >= dailyCommitment * 0.8 && dailyFocused < dailyCommitment;
    if (wasBelow && isCloseNow && dailyFocused > prevFocused.current) {
      const remaining = Math.max(1, Math.ceil(dailyCommitment - dailyFocused));
      void NotificationService.scheduleCloseToGoalNudge(remaining);
    }
    prevFocused.current = dailyFocused;
  }, [isHydrated, dailyFocused, dailyCommitment]);

  useEffect(() => {
    if (!isHydrated) return;
    async function recoverOrphanedEB() {
      try {
        const raw = await AsyncStorage.getItem(ACTIVE_EB_KEY);
        if (!raw) return;
        const info = JSON.parse(raw) as { startTimestamp: number; endTimestamp: number; durationMinutes: number };
        if (Date.now() < info.endTimestamp) {
          // Session is still active — the app was killed mid-session. iOS has
          // kept the ManagedSettingsStore shield in place, so route the user
          // back into the timer so they can see remaining time + hold-to-end.
          const navState = navigation.getState();
          const alreadyOnEB = navState?.routes.some((r) => r.name === 'ExecutionBlock');
          if (alreadyOnEB) return;
          navigation.navigate('ExecutionBlock', {
            durationMinutes: info.durationMinutes,
            resumeEndTimestamp: info.endTimestamp,
          });
          return;
        }
        await LockModeService.endSession();
        const elapsedMs = info.endTimestamp - info.startTimestamp;
        const elapsedMinutes = Math.ceil(Math.max(0, elapsedMs) / 60_000);
        if (elapsedMinutes >= 1) {
          dispatch({ type: 'COMPLETE_EXECUTION_BLOCK', payload: { durationMinutes: elapsedMinutes } });
        }
        await AsyncStorage.removeItem(ACTIVE_EB_KEY);
      } catch { AsyncStorage.removeItem(ACTIVE_EB_KEY); }
    }
    recoverOrphanedEB();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') recoverOrphanedEB();
    });
    return () => sub.remove();
  }, [isHydrated, dispatch, navigation]);

  useEffect(() => {
    if (!isHydrated) return;
    WeeklyReportService.shouldShowReport().then((shouldShow: boolean) => {
      if (shouldShow) navigation.navigate('WeeklyReport');
    });
  }, [isHydrated, navigation]);

  useEffect(() => {
    if (!isHydrated) return;
    (async () => {
      try {
        const pending = await AsyncStorage.getItem(PENDING_SIGNUP_KEY);
        if (pending === 'true') {
          await AsyncStorage.removeItem(PENDING_SIGNUP_KEY);
          navigation.navigate('SignUp');
        }
      } catch {}
    })();
  }, [isHydrated, navigation]);

  useEffect(() => {
    StreakRecoveryService.getRecoveryStatus().then((status) => {
      setCanRecover(status.available);
      setRecoveriesRemaining(status.maxPerWeek - status.usedThisWeek);
    });
  }, [state.consecutiveStreak, tick]);

  useEffect(() => {
    if (!isHydrated || !isAnonymous || state.consecutiveStreak < 3) return;
    AsyncStorage.getItem('@lockedin/signup_nudge_streak3_shown').then((v) => {
      if (!v) setShowSignUpNudge(true);
    });
  }, [isHydrated, isAnonymous, state.consecutiveStreak]);

  const streak = state.consecutiveStreak;
  const streakAtRisk = !dailyGoalMet && streak > 0 && !state.dailyGoalMetDate;

  if (!isHydrated) {
    return <View style={styles.loading} />;
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0A1628', '#0E1116', '#0E1116']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Subtle accent glow at top */}
      <View style={styles.glowOrb} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {streakAtRisk && canRecover && (
          <StreakAtRiskBanner onPress={() => setShowRecoveryModal(true)} />
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SystemStatusBar streakAtRisk={streakAtRisk && !canRecover} />
          <FocusRing
            focused={dailyFocused}
            goal={dailyCommitment}
            streakAtRisk={streakAtRisk && !canRecover}
          />
          <CompactMissions
            onPress={() => navigation.navigate('MissionsTab' as never)}
          />
        </ScrollView>
      </SafeAreaView>

      <StreakRecoveryModal
        visible={showRecoveryModal}
        streak={state.consecutiveStreak}
        recoveriesRemaining={recoveriesRemaining}
        onDismiss={() => {
          setShowRecoveryModal(false);
        }}
        onSavePress={async () => {
          const result = await StreakRecoveryService.useRecovery(state.consecutiveStreak);
          if (result.recovered) {
            Analytics.track('Streak Recovered', {
              streak_days: state.consecutiveStreak,
            });
            // Re-fetch recovery status after using one
            const status = await StreakRecoveryService.getRecoveryStatus();
            setCanRecover(status.available);
            setRecoveriesRemaining(status.maxPerWeek - status.usedThisWeek);
          }
          setShowRecoveryModal(false);
          dispatch({ type: 'RESET_PHASE' });
        }}
      />
      <SignUpNudgeSheet
        visible={showSignUpNudge}
        streak={state.consecutiveStreak}
        onDismiss={() => setShowSignUpNudge(false)}
      />
      {streakBreak && (
        <StreakBreakOverlay
          visible={true}
          previousStreakDays={streakBreak.previousStreakDays}
          previousRankId={streakBreak.previousRankId}
          onDismiss={() => setStreakBreak(null)}
        />
      )}
      <AppGuideSheet
        visible={homeGuide.visible}
        onDismiss={onHomeGuideDismiss}
        title="You are now Locked In."
        subtitle="Here's how your home screen works."
        tips={[
          { icon: 'flame-outline', iconColor: '#FF6B35', text: 'Your streak tracks consecutive days you hit your focus goal. Don\'t lose your streak.' },
          { icon: 'radio-button-on-outline', iconColor: Colors.primary, text: 'The focus ring shows today\'s progress toward your daily commitment.' },
          { icon: 'calendar-outline', iconColor: Colors.accent, text: 'Weekly Calendar shows your activity across the week at a glance.' },
          { icon: 'lock-closed-outline', iconColor: Colors.primary, text: 'Tap the Lock In button to start a focus session and block distractions.' },
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
  loading: {
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
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 140,
    gap: 12,
  },
});

export default HomeTab;
