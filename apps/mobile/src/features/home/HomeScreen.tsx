/**
 * HomeScreen — Primary screen composing all home components.
 *
 * Lock In button: always-open lock → opens duration picker → starts execution block.
 * Alignment/Reflection button: before 8 PM = "Start Alignment" (lock_in audio),
 *   after 8 PM = "Start Reflection" (unlock audio).
 * Daily Focus Tracker: progress bar showing focus time vs daily commitment.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  type AppStateStatus,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { useSession } from './state/SessionProvider';
import { useOnboarding } from '../onboarding/state/OnboardingProvider';
import {
  createSession,
  getRemaining,
  getDisplayDay,
  isProgramComplete,
} from './engine/SessionEngine';
import AnimatedGradient from './components/AnimatedGradient';
import DayOfWeekRow from './components/DayOfWeekRow';
import ProgressBlock from './components/ProgressBlock';
import LockButton from './components/LockButton';
import StatsRow from './components/StatsRow';
import IdentityCard from './components/IdentityCard';
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';
import { ClockService, type CTAState } from '../../services/ClockService';
import { SessionRepository } from '../../services/SessionRepository';
import { AudioService } from '../../services/AudioService';
import { NotificationService } from '../../services/NotificationService';
import type { ContentPhase } from '@lockedin/shared-types';
import { LockModeService } from '../../services/LockModeService';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { MixpanelService } from '../../services/MixpanelService';
import { Ionicons } from '@expo/vector-icons';
import ScrollPicker from './components/ScrollPicker';
import { ACTIVE_EB_KEY } from './ExecutionBlockScreen';

const TUTORIAL_STORAGE_KEY = '@lockedin/home_tutorial_shown';
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

const HOURS_VALUES = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_VALUES = Array.from({ length: 60 }, (_, i) => i);
const padTwo = (n: number) => n.toString().padStart(2, '0');

const SESSION_DURATION = 5; // minutes — alignment/reflection sessions

type Props = NativeStackScreenProps<MainStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, dispatch, isHydrated } = useSession();
  const { state: onboardingState } = useOnboarding();
  const { isSubscribed, showPaywall } = useSubscription();
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeRemaining, setResumeRemaining] = useState(0);
  const autoResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Duration picker (Lock In = execution block)
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [animateLock, setAnimateLock] = useState(false);
  const pendingDuration = useRef<number | null>(null);

  // Tutorial dialog
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialChecked = useRef(false);

  // ── Program day ──
  const programDay = useMemo(
    () => getDisplayDay(state.maxCompletedDay, state.lastLockInCompletedDate),
    [state.maxCompletedDay, state.lastLockInCompletedDate],
  );

  const programComplete = useMemo(
    () => isProgramComplete(state.maxCompletedDay),
    [state.maxCompletedDay],
  );

  // Force re-render on AppState resume or time-based transitions
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handleAppState = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        setTick((c) => c + 1);
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  // ── CTA state for Alignment/Reflection button ──
  const ctaState: CTAState = useMemo(
    () =>
      ClockService.getCTAState(
        state.lastLockInCompletedDate,
        state.lastUnlockCompletedDate,
      ),
    [state.lastLockInCompletedDate, state.lastUnlockCompletedDate, tick],
  );

  const isNight = useMemo(() => ClockService.isInUnlockWindow(), [tick]);

  // ── Alignment/Reflection completion status ──
  const todayKey = useMemo(() => ClockService.getLocalDateKey(), [tick]);
  const alignmentDone = state.lastLockInCompletedDate === todayKey;
  const reflectionDone = state.lastUnlockCompletedDate === todayKey;

  // ── Daily focus tracker ──
  const dailyCommitment = onboardingState.dailyMinutes ?? 60;
  const dailyFocused = useMemo(() => {
    if (state.dailyFocusDate === todayKey) return state.dailyFocusedMinutes;
    return 0;
  }, [state.dailyFocusedMinutes, state.dailyFocusDate, todayKey]);
  const focusProgress = Math.min(1, dailyFocused / dailyCommitment);
  const dailyGoalMet = dailyFocused >= dailyCommitment;

  useEffect(() => {
    if (dailyGoalMet && state.dailyGoalMetDate !== todayKey) {
      dispatch({ type: 'DAILY_GOAL_MET' });
    }
  }, [dailyGoalMet, state.dailyGoalMetDate, todayKey, dispatch]);

  // ── Live countdown + auto-transition ──
  useEffect(() => {
    if (ctaState.mode !== 'lock_in_done_waiting' && ctaState.mode !== 'all_done') return;
    const interval = setInterval(() => setTick((c) => c + 1), 60_000);

    const now = new Date();
    const target = new Date(now);
    if (ctaState.mode === 'lock_in_done_waiting') {
      target.setHours(20, 0, 0, 0);
      if (now >= target) { setTick((c) => c + 1); clearInterval(interval); return; }
    } else {
      target.setDate(target.getDate() + 1);
      target.setHours(0, 0, 0, 0);
    }
    const msUntilTransition = target.getTime() - now.getTime();
    const boundaryTimer = setTimeout(() => setTick((c) => c + 1), msUntilTransition + 500);
    return () => { clearInterval(interval); clearTimeout(boundaryTimer); };
  }, [ctaState.mode]);

  // ── First-open tutorial check ──
  useEffect(() => {
    if (!isHydrated || tutorialChecked.current) return;
    tutorialChecked.current = true;
    AsyncStorage.getItem(TUTORIAL_STORAGE_KEY).then((val) => {
      if (!val) setShowTutorial(true);
    });
  }, [isHydrated]);

  // ── Notification scheduling ──
  useEffect(() => {
    if (!isHydrated) return;
    NotificationService.scheduleAllDailyNotifications(state.consecutiveStreak);
  }, [isHydrated, state.consecutiveStreak]);

  // Cancel lock-in reminders + close-to-goal nudge when daily goal is met
  useEffect(() => {
    if (!isHydrated) return;
    if (dailyGoalMet) {
      NotificationService.cancelLockInReminders();
      NotificationService.cancelCloseToGoalNudge();
    }
  }, [isHydrated, dailyGoalMet]);

  // Schedule close-to-goal nudge when user is >= 80% but hasn't hit goal
  const prevFocused = useRef(dailyFocused);
  useEffect(() => {
    if (!isHydrated) return;
    const wasBelow = prevFocused.current < dailyCommitment;
    const isCloseNow = dailyFocused >= dailyCommitment * 0.8 && dailyFocused < dailyCommitment;
    if (wasBelow && isCloseNow && dailyFocused > prevFocused.current) {
      NotificationService.scheduleCloseToGoalNudge();
    }
    prevFocused.current = dailyFocused;
  }, [isHydrated, dailyFocused, dailyCommitment]);

  // ── Navigate to ProgramComplete once when program finishes ──
  useEffect(() => {
    if (isHydrated && programComplete && !state.programCompleteSeen) {
      dispatch({ type: 'MARK_PROGRAM_SEEN' });
      navigation.replace('ProgramComplete');
    }
  }, [isHydrated, programComplete, state.programCompleteSeen, dispatch, navigation]);

  // ── Prefetch day-based audio on mount / CTA change ──
  useEffect(() => {
    if (!isHydrated || programComplete) return;
    const phase: ContentPhase = isNight ? 'unlock' : 'lock_in';
    SessionRepository.getTrackForDay(programDay, phase).then((track) => {
      if (track) AudioService.load(track.signedAudioUrl);
    });
  }, [isHydrated, isNight, programDay, programComplete]);

  // ── Crash-resume check on hydration ──
  useEffect(() => {
    if (!isHydrated) return;
    if (!state.activeSession) return;
    const remaining = getRemaining(state.activeSession.expectedEndTimestamp);
    if (remaining <= 0 || remaining < 10) {
      dispatch({ type: 'COMPLETE_SESSION', payload: { durationMinutes: state.activeSession.durationMinutes } });
      return;
    }
    setResumeRemaining(remaining);
    setShowResumeModal(true);
    autoResumeTimer.current = setTimeout(() => handleResume(), 1500);
    return () => { if (autoResumeTimer.current) clearTimeout(autoResumeTimer.current); };
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recover orphaned execution blocks ──
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
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') recoverOrphanedEB();
    });
    return () => sub.remove();
  }, [isHydrated, dispatch]);

  const handleResume = useCallback(() => {
    if (autoResumeTimer.current) clearTimeout(autoResumeTimer.current);
    setShowResumeModal(false);
    Animated.timing(screenOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
      navigation.replace('Session', { phase: 'lock_in', programDay, resuming: true });
    });
  }, [navigation, screenOpacity, programDay]);

  const handleEndSession = useCallback(() => {
    if (autoResumeTimer.current) clearTimeout(autoResumeTimer.current);
    setShowResumeModal(false);
    LockModeService.endSession();
    if (state.activeSession) {
      dispatch({ type: 'COMPLETE_SESSION', payload: { durationMinutes: state.activeSession.durationMinutes } });
    }
  }, [dispatch, state.activeSession]);

  // ── Lock In button tap → show duration picker ──
  const handleLockPress = useCallback(() => {
    if (!isSubscribed) {
      navigation.navigate('PaywallOffer');
      return;
    }
    setShowDurationPicker(true);
  }, [isSubscribed, navigation]);

  // ── Lock animation complete → start execution block ──
  const handleLockAnimationComplete = useCallback(() => {
    const minutes = pendingDuration.current;
    if (!minutes) return;
    pendingDuration.current = null;

    MixpanelService.track('Lock In Started', { duration_minutes: minutes });
    LockModeService.beginSession();

    Animated.timing(screenOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
      setAnimateLock(false);
      navigation.replace('ExecutionBlock', { durationMinutes: minutes });
    });
  }, [screenOpacity, navigation]);

  // ── Duration selected from picker → animate lock ──
  const handleExecutionBlockSelect = useCallback((minutes: number) => {
    setShowDurationPicker(false);
    setShowCustomTime(false);

    if (!isSubscribed) {
      navigation.navigate('PaywallOffer');
      return;
    }

    pendingDuration.current = minutes;
    dispatch({ type: 'SET_ANIMATING' });
    setAnimateLock(true);
  }, [isSubscribed, navigation, dispatch]);

  // ── Alignment / Reflection tap ──
  const handleAlignmentPress = useCallback(async () => {
    if (!isSubscribed) {
      navigation.navigate('PaywallOffer');
      return;
    }

    const phase: ContentPhase = isNight ? 'unlock' : 'lock_in';

    if (phase === 'lock_in') {
      const session = createSession(SESSION_DURATION);
      MixpanelService.track('Alignment Started', { phase: 'lock_in', program_day: programDay });
      LockModeService.beginSession();
      dispatch({
        type: 'START_SESSION',
        payload: {
          startTimestamp: session.startTimestamp,
          expectedEndTimestamp: session.expectedEndTimestamp,
          durationMinutes: SESSION_DURATION,
        },
      });
      Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
        navigation.replace('Session', { phase: 'lock_in', programDay, resuming: false });
      });
    } else {
      MixpanelService.track('Reflection Started', { phase: 'unlock', program_day: programDay });
      LockModeService.beginSession();
      Animated.timing(screenOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        navigation.replace('Session', { phase: 'unlock', programDay, resuming: false });
      });
    }
  }, [isSubscribed, isNight, dispatch, navigation, screenOpacity, programDay]);

  // ── Tutorial dismiss ──
  const handleDismissTutorial = useCallback(() => {
    setShowTutorial(false);
    AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
  }, []);

  // ── Reset opacity when screen mounts or comes back into focus ──
  useEffect(() => {
    screenOpacity.setValue(1);
    const unsubscribe = navigation.addListener('focus', () => {
      screenOpacity.setValue(1);
    });
    return unsubscribe;
  }, [navigation, screenOpacity]);

  if (!isHydrated) {
    return <View style={styles.loading} />;
  }

  // ── Alignment button config ──
  const alignBtnDone = isNight ? reflectionDone : alignmentDone;
  const alignBtnLabel = isNight
    ? (reflectionDone ? 'Reflected Today' : 'Start Reflection')
    : (alignmentDone ? 'Aligned Today' : 'Start Alignment');
  const alignBtnIcon = isNight ? 'moon-outline' : 'sunny-outline';
  const alignBtnColor = isNight ? '#B0A0FF' : '#FFC857';

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <AnimatedGradient />

      <SafeAreaView style={styles.safeArea}>
        <DayOfWeekRow />

        <View style={styles.progressSection}>
          <ProgressBlock />
        </View>

        {/* Daily Focus Tracker */}
        <View style={styles.focusTracker}>
          <View style={styles.focusHeader}>
            <Ionicons name="timer-outline" size={14} color={Colors.accent} />
            <Text style={styles.focusLabel}>
              {dailyFocused} of {dailyCommitment} min focused today
            </Text>
          </View>
          <View style={styles.focusBarTrack}>
            <View style={[styles.focusBarFill, { width: `${focusProgress * 100}%` }]} />
          </View>
        </View>

        <View style={styles.lockSection}>
          <LockButton
            onPress={handleLockPress}
            onAnimationComplete={handleLockAnimationComplete}
            animateLock={animateLock}
          />
        </View>

        {/* Alignment / Reflection Button */}
        <TouchableOpacity
          style={[styles.alignmentButton, alignBtnDone && styles.alignmentButtonDone]}
          onPress={handleAlignmentPress}
          activeOpacity={0.7}
          disabled={alignBtnDone}
        >
          <Ionicons
            name={alignBtnIcon as any}
            size={16}
            color={alignBtnDone ? Colors.textMuted : alignBtnColor}
            style={styles.alignmentIcon}
          />
          <Text style={[styles.alignmentText, alignBtnDone && styles.alignmentTextDone]}>
            {alignBtnLabel}
          </Text>
        </TouchableOpacity>

        <StatsRow />

        <View style={styles.identitySection}>
          <IdentityCard />
        </View>
      </SafeAreaView>

      {/* Resume Interstitial Modal */}
      <Modal visible={showResumeModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Session in progress</Text>
            <Text style={styles.modalRemaining}>
              {Math.floor(resumeRemaining / 60)}:{String(resumeRemaining % 60).padStart(2, '0')} remaining
            </Text>
            <TouchableOpacity onPress={handleResume} style={styles.modalPrimary} activeOpacity={0.9}>
              <Text style={styles.modalPrimaryText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEndSession} style={styles.modalSecondary} activeOpacity={0.7}>
              <Text style={styles.modalSecondaryText}>End Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Duration Picker Modal */}
      <Modal
        visible={showDurationPicker}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { setShowCustomTime(false); setShowDurationPicker(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lock In</Text>
            <Text style={styles.pickerSubtext}>
              How long do you want to lock in?
            </Text>

            {!showCustomTime ? (
              <>
                <View style={styles.durationGrid}>
                  {DURATION_OPTIONS.map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={styles.durationOption}
                      onPress={() => handleExecutionBlockSelect(mins)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.durationValue}>
                        {mins >= 60 ? `${mins / 60}h` : `${mins}`}
                      </Text>
                      {mins < 60 && <Text style={styles.durationLabel}>min</Text>}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.durationOption}
                    onPress={() => setShowCustomTime(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="timer-outline" size={24} color={Colors.accent} />
                    <Text style={styles.durationLabel}>Custom</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.customTimeContainer}>
                <View style={styles.customTimeRow}>
                  <ScrollPicker
                    values={HOURS_VALUES}
                    selectedValue={customHours}
                    onValueChange={setCustomHours}
                    formatValue={padTwo}
                    label="Hours"
                    style={styles.customTimeColumn}
                  />
                  <Text style={styles.customTimeSeparator}>:</Text>
                  <ScrollPicker
                    values={MINUTES_VALUES}
                    selectedValue={customMinutes}
                    onValueChange={setCustomMinutes}
                    formatValue={padTwo}
                    label="Minutes"
                    style={styles.customTimeColumn}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.customTimeConfirm, (customHours === 0 && customMinutes === 0) && styles.customTimeConfirmDisabled]}
                  onPress={() => {
                    const total = customHours * 60 + customMinutes;
                    if (total > 0) {
                      setShowCustomTime(false);
                      handleExecutionBlockSelect(total);
                    }
                  }}
                  activeOpacity={0.9}
                  disabled={customHours === 0 && customMinutes === 0}
                >
                  <Text style={styles.customTimeConfirmText}>
                    Start {customHours > 0 ? `${customHours}h ` : ''}{customMinutes > 0 ? `${customMinutes}m` : ''} Block
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowCustomTime(false)} style={styles.modalSecondary} activeOpacity={0.7}>
                  <Text style={styles.modalSecondaryText}>Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {!showCustomTime && (
              <TouchableOpacity
                onPress={() => { setShowCustomTime(false); setShowDurationPicker(false); }}
                style={styles.modalSecondary}
                activeOpacity={0.7}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* First-Open Tutorial Dialog */}
      <Modal visible={showTutorial} transparent animationType="fade" statusBarTranslucent onRequestClose={handleDismissTutorial}>
        <View style={styles.modalOverlay}>
          <View style={styles.tutorialCard}>
            {/* Glass edge highlight */}
            <View style={styles.tutorialEdgeHighlight} pointerEvents="none" />

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.tutorialTitle}>How It Works</Text>
              <View style={styles.tutorialDivider} />

              <View style={styles.tutorialSection}>
                <View style={styles.tutorialIconWrap}>
                  <View style={styles.tutorialIconCircle}>
                    <Ionicons name="lock-closed" size={18} color={Colors.accent} />
                  </View>
                </View>
                <View style={styles.tutorialContent}>
                  <Text style={styles.tutorialHeading}>Lock In</Text>
                  <Text style={styles.tutorialBody}>
                    Choose a duration, eliminate distractions, and advance your 90-day program. Hit your daily goal to build your streak.
                  </Text>
                </View>
              </View>

              <View style={styles.tutorialSection}>
                <View style={styles.tutorialIconWrap}>
                  <View style={styles.tutorialIconCircle}>
                    <Ionicons name="sunny-outline" size={18} color="#FFC857" />
                  </View>
                </View>
                <View style={styles.tutorialContent}>
                  <Text style={styles.tutorialHeading}>Daily Alignment</Text>
                  <Text style={styles.tutorialBody}>
                    Optional guided session. Learn from the mindset and teachings of the world's most successful people.
                  </Text>
                </View>
              </View>

              <View style={styles.tutorialSection}>
                <View style={styles.tutorialIconWrap}>
                  <View style={styles.tutorialIconCircle}>
                    <Ionicons name="moon-outline" size={18} color="#B0A0FF" />
                  </View>
                </View>
                <View style={styles.tutorialContent}>
                  <Text style={styles.tutorialHeading}>Nightly Reflection</Text>
                  <Text style={styles.tutorialBody}>
                    Evening review session. Opens at 8 PM after alignment is complete.
                  </Text>
                </View>
              </View>

              <View style={[styles.tutorialSection, { marginBottom: 0 }]}>
                <View style={styles.tutorialIconWrap}>
                  <View style={styles.tutorialIconCircle}>
                    <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
                  </View>
                </View>
                <View style={styles.tutorialContent}>
                  <Text style={styles.tutorialHeading}>Missed Day</Text>
                  <Text style={styles.tutorialBody}>
                    If you don't hit your daily lock-in goal by midnight, your streak resets.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity onPress={handleDismissTutorial} style={styles.tutorialButton} activeOpacity={0.85}>
              <Text style={styles.tutorialButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, backgroundColor: Colors.background },
  safeArea: { flex: 1, paddingHorizontal: 20 },
  progressSection: { marginTop: 8, marginBottom: 4 },
  lockSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '35%',
  },
  // ── Focus Tracker ──
  focusTracker: {
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  focusLabel: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    marginLeft: 6,
  },
  focusBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  focusBarFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  // ── Alignment Button ──
  alignmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surface,
    marginBottom: 12,
  },
  alignmentButtonDone: {
    opacity: 0.5,
  },
  alignmentIcon: {
    marginRight: 8,
  },
  alignmentText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  alignmentTextDone: {
    color: Colors.textMuted,
  },
  identitySection: { marginBottom: 16, paddingHorizontal: 4 },
  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  modalTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  modalRemaining: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  modalPrimary: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 6,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  modalPrimaryText: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  modalSecondary: { paddingVertical: 12, alignItems: 'center', width: '100%' },
  modalSecondaryText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.textMuted },
  // Duration picker
  pickerSubtext: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  durationOption: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.textPrimary,
  },
  durationLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  customTimeContainer: { alignItems: 'center', width: '100%', marginBottom: 8 },
  customTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    width: '100%',
  },
  customTimeColumn: { flex: 1 },
  customTimeSeparator: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    color: Colors.textMuted,
    width: 20,
    textAlign: 'center',
  },
  customTimeConfirm: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  customTimeConfirmDisabled: { opacity: 0.4 },
  customTimeConfirmText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  // Tutorial dialog
  tutorialCard: {
    backgroundColor: 'rgba(16, 20, 28, 0.92)',
    borderRadius: 24,
    padding: 28,
    paddingTop: 32,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 24,
    overflow: 'hidden',
  },
  tutorialEdgeHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  tutorialTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  tutorialDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 24,
    marginHorizontal: -4,
  },
  tutorialSection: {
    flexDirection: 'row',
    marginBottom: 22,
  },
  tutorialIconWrap: {
    width: 40,
    alignItems: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  tutorialIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialContent: { flex: 1 },
  tutorialHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 5,
    letterSpacing: -0.1,
  },
  tutorialBody: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 21,
  },
  tutorialButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    width: '100%',
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  tutorialButtonText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.55)',
    letterSpacing: 0.5,
  },
});

export default HomeScreen;
