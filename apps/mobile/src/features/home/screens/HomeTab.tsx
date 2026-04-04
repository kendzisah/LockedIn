/**
 * HomeTab — Focus + Streak. Glassmorphic dark UI with gradient background.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../state/SessionProvider';
import { useOnboarding } from '../../onboarding/state/OnboardingProvider';
import { useSubscription } from '../../subscription/SubscriptionProvider';
import { ClockService } from '../../../services/ClockService';
import { NotificationService } from '../../../services/NotificationService';
import { LockModeService } from '../../../services/LockModeService';
import { MixpanelService } from '../../../services/MixpanelService';
import { StreakRecoveryService } from '../../streak/StreakRecoveryService';
import WeeklyReportService from '../../report/WeeklyReportService';
import { ACTIVE_EB_KEY } from '../ExecutionBlockScreen';
import { useMissions } from '../../missions/MissionsProvider';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { getStreakTierInfo } from '../../../design/streakTiers';
import FocusRing from '../components/FocusRing';
import DayDots from '../components/DayDots';
import StreakBar from '../components/StreakBar';
import CompactMissions from '../components/CompactMissions';
import StreakAtRiskBanner from '../components/StreakAtRiskBanner';
import { StreakRecoveryModal } from '../../streak/components/StreakRecoveryModal';
import { useAuth } from '../../auth/AuthProvider';
import SignUpNudgeSheet from '../../auth/components/SignUpNudgeSheet';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

const PENDING_SIGNUP_KEY = '@lockedin/pending_signup';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const HomeTab: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { state, dispatch, isHydrated } = useSession();
  const { state: onboardingState } = useOnboarding();
  const { isSubscribed } = useSubscription();
  const { completedCount, lockedInToday } = useMissions();

  useEffect(() => {
    if (lockedInToday) {
      void NotificationService.cancelMissionReminder();
    }
  }, [lockedInToday]);

  const { isAnonymous } = useAuth();
  const [tick, setTick] = useState(0);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [canRecover, setCanRecover] = useState(false);
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
        await LockModeService.endSession();
        const now = Date.now();
        const elapsedMs = Math.min(now, info.endTimestamp) - info.startTimestamp;
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
  }, [isHydrated, dispatch]);

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
    StreakRecoveryService.canRecover().then(setCanRecover);
  }, [state.consecutiveStreak, tick]);

  useEffect(() => {
    if (!isHydrated || !isAnonymous || state.consecutiveStreak < 3) return;
    AsyncStorage.getItem('@lockedin/signup_nudge_streak3_shown').then((v) => {
      if (!v) setShowSignUpNudge(true);
    });
  }, [isHydrated, isAnonymous, state.consecutiveStreak]);

  const streak = state.consecutiveStreak;
  const tierInfo = useMemo(() => getStreakTierInfo(streak), [streak]);
  const streakAtRisk = !dailyGoalMet && streak > 0 && !state.dailyGoalMetDate;

  if (!isHydrated) {
    return <View style={styles.loading} />;
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0E1116', '#111922', '#0E1116']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Subtle accent glow at top */}
      <View style={styles.glowOrb} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.title}>Lock In.</Text>
          </View>
          <View style={[styles.streakPill, streak > 0 && { backgroundColor: `${tierInfo.color}15`, borderColor: `${tierInfo.color}30` }]}>
            <LottieView
              source={require('../../../../assets/lottie/fire.json')}
              autoPlay
              loop
              style={styles.streakFlame}
            />
            <Text style={[styles.streakNum, streak > 0 && { color: tierInfo.color }]}>
              {streak}
            </Text>
          </View>
        </View>

        {streakAtRisk && canRecover && (
          <StreakAtRiskBanner onPress={() => setShowRecoveryModal(true)} />
        )}

        <DayDots />
        <FocusRing focused={dailyFocused} goal={dailyCommitment} streakAtRisk={streakAtRisk && !canRecover} />
        <StreakBar streak={streak} />
        <CompactMissions onPress={() => {}} />
      </SafeAreaView>

      <StreakRecoveryModal
        visible={showRecoveryModal}
        streak={state.consecutiveStreak}
        recoveriesRemaining={2}
        onDismiss={() => setShowRecoveryModal(false)}
        onSavePress={() => {
          setShowRecoveryModal(false);
          dispatch({ type: 'RESET_PHASE' });
        }}
      />
      <SignUpNudgeSheet
        visible={showSignUpNudge}
        streak={state.consecutiveStreak}
        onDismiss={() => setShowSignUpNudge(false)}
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
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  greeting: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,71,87,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.12)',
  },
  streakFlame: {
    width: 22,
    height: 22,
  },
  streakNum: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    color: Colors.textPrimary,
  },
});

export default HomeTab;
