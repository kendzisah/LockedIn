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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import type { ContentPhase } from '@lockedin/shared-types';
import { LockModeService } from '../../services/LockModeService';

const SESSION_DURATION = 5; // minutes — all sessions are ~5 min

interface SessionInfo {
  title: string;
  coreTenet: string | null;
}

type Props = NativeStackScreenProps<MainStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, dispatch, isHydrated } = useSession();
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeRemaining, setResumeRemaining] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const autoResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const handleLockAnimationComplete = useCallback(() => {
    const phase: ContentPhase =
      ctaState.mode === 'unlock' ? 'unlock' : 'lock_in';

    if (phase === 'lock_in') {
      // Lock In: create active session, shield apps, animate, navigate
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
      // Unlock: navigate directly (no lock animation, no crash-resume)
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
  }, [ctaState.mode, dispatch, navigation, screenOpacity, programDay]);

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
});

export default HomeScreen;
