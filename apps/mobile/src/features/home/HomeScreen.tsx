/**
 * HomeScreen — Primary screen composing all home components.
 *
 * CTA state machine driven by ClockService.getCTAState():
 *   lock_in              → open lock, "Tap to Lock In"
 *   lock_in_done_waiting → closed lock, "Locked In Today", hint
 *   unlock               → closed lock, "Tap to Reflect"
 *   all_done             → closed lock, "Complete Today"
 *
 * All sessions are 5 min. No duration selector.
 * Prefetches day-based audio on mount. Re-evaluates CTA on AppState resume.
 *
 * Program completion gate: if maxCompletedDay >= 90, navigate to ProgramComplete.
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
import { Ionicons } from '@expo/vector-icons';
import ScrollPicker from './components/ScrollPicker';
import { ACTIVE_EB_KEY } from './ExecutionBlockScreen';

const TUTORIAL_STORAGE_KEY = '@lockedin/home_tutorial_shown';
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

const HOURS_VALUES = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_VALUES = Array.from({ length: 60 }, (_, i) => i);
const padTwo = (n: number) => n.toString().padStart(2, '0');

const SESSION_DURATION = 5; // minutes — all sessions are ~5 min

interface SessionInfo {
  title: string;
  coreTenet: string | null;
}

type Props = NativeStackScreenProps<MainStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, dispatch, isHydrated } = useSession();
  const { isSubscribed, showPaywall } = useSubscription();
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeRemaining, setResumeRemaining] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const autoResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Execution Block
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(30);

  // Tutorial dialog
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialChecked = useRef(false);

  // ── Program day ──
  // Display day stays on the current day after Lock In (reflect is same day)
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

  // ── CTA state (re-evaluated on mount, focus, AppState resume, and tick) ──
  const ctaState: CTAState = useMemo(
    () =>
      ClockService.getCTAState(
        state.lastLockInCompletedDate,
        state.lastUnlockCompletedDate,
      ),
    [state.lastLockInCompletedDate, state.lastUnlockCompletedDate, tick],
  );

  // ── Live countdown + auto-transition ──
  // Tick every 60s while in a waiting state so the countdown hint updates.
  // Also schedules exact transition at the boundary (8 PM or midnight).
  useEffect(() => {
    if (
      ctaState.mode !== 'lock_in_done_waiting' &&
      ctaState.mode !== 'all_done'
    )
      return;

    // Tick every minute to keep countdown hint fresh
    const interval = setInterval(() => {
      setTick((c) => c + 1);
    }, 60_000);

    // Schedule exact transition at the boundary
    const now = new Date();
    const target = new Date(now);

    if (ctaState.mode === 'lock_in_done_waiting') {
      target.setHours(20, 0, 0, 0);
      if (now >= target) {
        setTick((c) => c + 1);
        clearInterval(interval);
        return;
      }
    } else {
      target.setDate(target.getDate() + 1);
      target.setHours(0, 0, 0, 0);
    }

    const msUntilTransition = target.getTime() - now.getTime();
    const boundaryTimer = setTimeout(() => {
      setTick((c) => c + 1);
    }, msUntilTransition + 500);

    return () => {
      clearInterval(interval);
      clearTimeout(boundaryTimer);
    };
  }, [ctaState.mode]);

  // ── First-open tutorial check ──
  useEffect(() => {
    if (!isHydrated || tutorialChecked.current) return;
    tutorialChecked.current = true;

    AsyncStorage.getItem(TUTORIAL_STORAGE_KEY).then((val) => {
      if (!val) setShowTutorial(true);
    });
  }, [isHydrated]);

  // ── Lock In reminder notification scheduling ──
  useEffect(() => {
    if (!isHydrated) return;
    const todayKey = new Date().toISOString().slice(0, 10);

    if (state.lastLockInCompletedDate === todayKey) {
      NotificationService.cancelLockInReminder();
    } else {
      NotificationService.scheduleLockInReminder();
    }
  }, [isHydrated, state.lastLockInCompletedDate]);

  // ── Navigate to ProgramComplete if program is done ──
  useEffect(() => {
    if (isHydrated && programComplete) {
      navigation.replace('ProgramComplete');
    }
  }, [isHydrated, programComplete, navigation]);

  // ── Prefetch day-based audio on mount / CTA change ──
  useEffect(() => {
    if (!isHydrated || programComplete) return;

    const phase: ContentPhase =
      ctaState.mode === 'unlock' ? 'unlock' : 'lock_in';

    // Prefetch track metadata AND pre-load audio binary so it's ready when session starts
    SessionRepository.getTrackForDay(programDay, phase).then((track) => {
      if (track) {
        setSessionInfo({ title: track.title, coreTenet: track.coreTenet });
        // Pre-load audio binary — AudioService deduplicates concurrent loads
        AudioService.load(track.signedAudioUrl);
      }
    });
  }, [isHydrated, ctaState.mode, programDay, programComplete]);

  // ── Crash-resume check on hydration ──
  useEffect(() => {
    if (!isHydrated) return;
    if (!state.activeSession) return;

    const remaining = getRemaining(state.activeSession.expectedEndTimestamp);

    if (remaining <= 0 || remaining < 10) {
      dispatch({
        type: 'COMPLETE_SESSION',
        payload: { durationMinutes: state.activeSession.durationMinutes },
      });
      return;
    }

    setResumeRemaining(remaining);
    setShowResumeModal(true);

    autoResumeTimer.current = setTimeout(() => {
      handleResume();
    }, 1500);

    return () => {
      if (autoResumeTimer.current) clearTimeout(autoResumeTimer.current);
    };
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recover orphaned execution blocks (app-kill, background expiry, mid-block kill) ──
  useEffect(() => {
    if (!isHydrated) return;

    async function recoverOrphanedEB() {
      try {
        const raw = await AsyncStorage.getItem(ACTIVE_EB_KEY);
        if (!raw) return;

        const info = JSON.parse(raw) as {
          startTimestamp: number;
          endTimestamp: number;
          durationMinutes: number;
        };

        await LockModeService.endSession();

        const now = Date.now();
        const elapsedMs = Math.min(now, info.endTimestamp) - info.startTimestamp;
        const elapsedMinutes = Math.ceil(Math.max(0, elapsedMs) / 60_000);

        if (elapsedMinutes >= 1) {
          dispatch({
            type: 'COMPLETE_EXECUTION_BLOCK',
            payload: { durationMinutes: elapsedMinutes },
          });
        }

        await AsyncStorage.removeItem(ACTIVE_EB_KEY);
      } catch {
        AsyncStorage.removeItem(ACTIVE_EB_KEY);
      }
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

    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      navigation.replace('Session', {
        phase: 'lock_in', // crash-resume is always for Lock In
        programDay,
        resuming: true,
      });
    });
  }, [navigation, screenOpacity, programDay]);

  const handleEndSession = useCallback(() => {
    if (autoResumeTimer.current) clearTimeout(autoResumeTimer.current);
    setShowResumeModal(false);

    LockModeService.endSession();

    if (state.activeSession) {
      dispatch({
        type: 'COMPLETE_SESSION',
        payload: { durationMinutes: state.activeSession.durationMinutes },
      });
    }
  }, [dispatch, state.activeSession]);

  // ── Lock animation complete → start session → navigate ──
  const handleLockAnimationComplete = useCallback(async () => {
    if (!isSubscribed) {
      await showPaywall();
      return;
    }

    const phase: ContentPhase =
      ctaState.mode === 'unlock' ? 'unlock' : 'lock_in';

    if (phase === 'lock_in') {
      const session = createSession(SESSION_DURATION);

      LockModeService.beginSession();

      dispatch({
        type: 'START_SESSION',
        payload: {
          startTimestamp: session.startTimestamp,
          expectedEndTimestamp: session.expectedEndTimestamp,
          durationMinutes: SESSION_DURATION,
        },
      });

      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        navigation.replace('Session', {
          phase: 'lock_in',
          programDay,
          resuming: false,
        });
      });
    } else {
      LockModeService.beginSession();

      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        navigation.replace('Session', {
          phase: 'unlock',
          programDay,
          resuming: false,
        });
      });
    }
  }, [ctaState.mode, dispatch, navigation, screenOpacity, programDay, isSubscribed, showPaywall]);

  // ── Tutorial dismiss ──
  const handleDismissTutorial = useCallback(() => {
    setShowTutorial(false);
    AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
  }, []);

  // ── Execution Block ──
  const handleExecutionBlockSelect = useCallback(async (minutes: number) => {
    setShowDurationPicker(false);

    if (!isSubscribed) {
      await showPaywall();
      return;
    }

    LockModeService.beginSession();

    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      navigation.replace('ExecutionBlock', { durationMinutes: minutes });
    });
  }, [isSubscribed, showPaywall, screenOpacity, navigation]);

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

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <AnimatedGradient />

      <SafeAreaView style={styles.safeArea}>
        <DayOfWeekRow />

        <View style={styles.progressSection}>
          <ProgressBlock />
        </View>

        {sessionInfo && (
          <View style={styles.sessionInfoSection}>
            <Text style={styles.sessionTitle}>{sessionInfo.title}</Text>
            {sessionInfo.coreTenet && (
              <Text style={styles.sessionCoreTenet}>{sessionInfo.coreTenet}</Text>
            )}
          </View>
        )}

        <View style={styles.lockSection}>
          <LockButton
            ctaMode={ctaState.mode}
            hint={ctaState.hint}
            onAnimationComplete={handleLockAnimationComplete}
          />
        </View>

        {/* Execution Block Button */}
        <TouchableOpacity
          style={styles.executionBlockButton}
          onPress={() => setShowDurationPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="flash" size={16} color={Colors.accent} style={styles.executionBlockIcon} />
          <Text style={styles.executionBlockText}>Execution Block</Text>
        </TouchableOpacity>

        <StatsRow />

        <View style={styles.identitySection}>
          <IdentityCard />
        </View>
      </SafeAreaView>

      {/* Resume Interstitial Modal */}
      <Modal
        visible={showResumeModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Session in progress</Text>
            <Text style={styles.modalRemaining}>
              {Math.floor(resumeRemaining / 60)}:{String(resumeRemaining % 60).padStart(2, '0')} remaining
            </Text>
            <TouchableOpacity
              onPress={handleResume}
              style={styles.modalPrimary}
              activeOpacity={0.9}
            >
              <Text style={styles.modalPrimaryText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleEndSession}
              style={styles.modalSecondary}
              activeOpacity={0.7}
            >
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
            <Text style={styles.modalTitle}>Execution Block</Text>
            <Text style={styles.pickerSubtext}>
              Lock down your phone. Choose a duration.
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
                  style={[
                    styles.customTimeConfirm,
                    (customHours === 0 && customMinutes === 0) && styles.customTimeConfirmDisabled,
                  ]}
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
                <TouchableOpacity
                  onPress={() => setShowCustomTime(false)}
                  style={styles.modalSecondary}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalSecondaryText}>Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {!showCustomTime && (
              <TouchableOpacity
                onPress={() => {
                  setShowCustomTime(false);
                  setShowDurationPicker(false);
                }}
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
      <Modal
        visible={showTutorial}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleDismissTutorial}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tutorialCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.tutorialTitle}>How It Works</Text>

              <View style={styles.tutorialSection}>
                <View style={styles.tutorialIconWrap}>
                  <Ionicons name="lock-closed" size={22} color={Colors.accent} />
                </View>
                <View style={styles.tutorialContent}>
                  <Text style={styles.tutorialHeading}>Lock In</Text>
                  <Text style={styles.tutorialBody}>
                    Your daily 5-minute discipline session. Available all day. Builds your streak and advances your 90-day program.
                  </Text>
                </View>
              </View>

              <View style={styles.tutorialSection}>
                <View style={styles.tutorialIconWrap}>
                  <Ionicons name="lock-open" size={22} color={Colors.accent} />
                </View>
                <View style={styles.tutorialContent}>
                  <Text style={styles.tutorialHeading}>Reflect</Text>
                  <Text style={styles.tutorialBody}>
                    Evening review session. Opens at 8 PM after Lock In is complete. Adds listening time.
                  </Text>
                </View>
              </View>

              <View style={styles.tutorialSection}>
                <View style={styles.tutorialIconWrap}>
                  <Ionicons name="flash" size={22} color={Colors.accent} />
                </View>
                <View style={styles.tutorialContent}>
                  <Text style={styles.tutorialHeading}>Execution Block</Text>
                  <Text style={styles.tutorialBody}>
                    Focus timer for any task. Lock down your phone for a custom duration. Available anytime, unlimited uses.
                  </Text>
                </View>
              </View>

              <View style={styles.tutorialSection}>
                <View style={styles.tutorialIconWrap}>
                  <Ionicons name="calendar-outline" size={22} color={Colors.textMuted} />
                </View>
                <View style={styles.tutorialContent}>
                  <Text style={styles.tutorialHeading}>Missed Day</Text>
                  <Text style={styles.tutorialBody}>
                    If you don't complete a Lock In by midnight, your streak resets.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={handleDismissTutorial}
              style={styles.tutorialButton}
              activeOpacity={0.9}
            >
              <Text style={styles.tutorialButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  progressSection: {
    marginTop: 8,
    marginBottom: 4,
  },
  sessionInfoSection: {
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  sessionTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  sessionCoreTenet: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
    letterSpacing: 0.1,
    lineHeight: 16,
  },
  lockSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '35%',
  },
  executionBlockButton: {
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
  executionBlockIcon: {
    marginRight: 8,
  },
  executionBlockText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.accent,
    letterSpacing: 0.2,
  },
  identitySection: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
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
  modalSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  modalSecondaryText: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textMuted,
  },
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
  // Custom time picker
  customTimeContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  customTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    width: '100%',
  },
  customTimeColumn: {
    flex: 1,
  },
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
  customTimeConfirmDisabled: {
    opacity: 0.4,
  },
  customTimeConfirmText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  // Tutorial dialog
  tutorialCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  tutorialTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  tutorialSection: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  tutorialIconWrap: {
    width: 36,
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  tutorialContent: {
    flex: 1,
  },
  tutorialHeading: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  tutorialBody: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  tutorialButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
  },
  tutorialButtonText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
});

export default HomeScreen;
