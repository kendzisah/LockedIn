/**
 * QuickLockInSessionScreen — Onboarding Lock In demo.
 *
 * Fetches the active onboarding track from Supabase (audio_tracks category='onboarding').
 * Timer matches the audio length. Falls back to 2-minute timer-only if no track exists
 * or audio fails to load.
 *
 * On background: pauses audio + timer. On resume: shows resume modal.
 * On completion: dispatches SET_DEMO_COMPLETED and navigates to QuickLockInComplete.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  type AppStateStatus,
  BackHandler,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import { LockModeService } from '../../../services/LockModeService';
import PrimaryButton from '../../../design/components/PrimaryButton';
import { Colors } from '../../../design/colors';
import { Typography, FontFamily } from '../../../design/typography';
import { AudioService } from '../../../services/AudioService';
import { SessionRepository, type OnboardingTrack } from '../../../services/SessionRepository';

const FALLBACK_SECONDS = 120; // 2 minutes if no onboarding track

function getPhaseText(elapsed: number, total: number): string {
  const pct = total > 0 ? elapsed / total : 0;
  if (pct < 0.25) return 'Breathe. Control your body.';
  if (pct < 0.75) return 'Identity: You do what you said you would do.';
  return 'Execute: One task. No delay.';
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'QuickLockInSession'
>;

const QuickLockInSessionScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();

  // Total seconds determined by onboarding track duration or fallback
  const [totalSeconds, setTotalSeconds] = useState(FALLBACK_SECONDS);
  const [remaining, setRemaining] = useState(FALLBACK_SECONDS);
  const [paused, setPaused] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioStatus, setAudioStatus] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ── Screen-level fade ──
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // ── Fetch and load onboarding track ──
  useEffect(() => {
    let cancelled = false;

    async function loadOnboardingTrack() {
      setAudioStatus('Loading audio...');

      const track: OnboardingTrack | null = await SessionRepository.getOnboardingTrack();

      if (cancelled) return;

      if (!track) {
        // No onboarding track configured — timer-only mode
        setAudioStatus(null);
        setTotalSeconds(FALLBACK_SECONDS);
        setRemaining(FALLBACK_SECONDS);
        return;
      }

      // Set timer to match audio duration
      const trackDuration = track.durationSeconds;
      if (trackDuration > 0) {
        setTotalSeconds(trackDuration);
        setRemaining(trackDuration);
      }

      const loaded = await AudioService.load(track.signedAudioUrl);

      if (cancelled) return;

      if (loaded) {
        setAudioLoaded(true);
        setAudioStatus(null);
        AudioService.play();
      } else {
        setAudioStatus(null);
        // Audio failed — keep timer-only
      }
    }

    loadOnboardingTrack();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Cleanup audio on unmount ──
  useEffect(() => {
    return () => {
      AudioService.unload();
    };
  }, []);

  // ── Timer logic ──
  const startTimer = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start timer on mount
  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [startTimer, stopTimer]);

  // ── Completion ──
  useEffect(() => {
    if (remaining === 0) {
      LockModeService.endSession();
      AudioService.stop();
      dispatch({ type: 'SET_DEMO_COMPLETED' });
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        navigation.replace('QuickLockInComplete');
      });
    }
  }, [remaining, dispatch, navigation, screenOpacity]);

  // ── Android back handler ──
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      const mins = Math.ceil(totalSeconds / 60);
      Alert.alert(
        'Stay Locked',
        `Finish the ${mins} minutes. Stay locked.`,
        [{ text: 'OK', style: 'cancel' }],
        { cancelable: false },
      );
      return true;
    });
    return () => handler.remove();
  }, [totalSeconds]);

  // ── AppState handler: pause/resume ──
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const wasActive = appStateRef.current === 'active';
        const isActive = nextState === 'active';

        if (wasActive && !isActive) {
          stopTimer();
          AudioService.pause();
          setPaused(true);
        } else if (!wasActive && isActive && paused) {
          setShowResumeModal(true);
        }

        appStateRef.current = nextState;
      },
    );

    return () => subscription.remove();
  }, [paused, stopTimer]);

  const handleResume = () => {
    setShowResumeModal(false);
    setConfirmEnd(false);
    setPaused(false);
    startTimer();
    if (audioLoaded) AudioService.play();
  };

  const handleEndRequest = () => {
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    setShowResumeModal(false);
    setPaused(false);
    stopTimer();
    AudioService.stop();
    LockModeService.endSession();
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.replace('QuickLockInComplete');
    });
  };

  const elapsed = totalSeconds - remaining;

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <View style={styles.content}>
        <Text style={styles.timer}>{formatTime(remaining)}</Text>
        <Text style={styles.phase}>{getPhaseText(elapsed, totalSeconds)}</Text>
        {audioStatus && (
          <Text style={styles.audioStatus}>{audioStatus}</Text>
        )}
      </View>

      <Modal
        visible={showResumeModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Session paused</Text>
            <Text style={styles.modalSubtext}>
              You left the app. Pick up where you left off.
            </Text>
            <PrimaryButton title="Resume Lock In" onPress={handleResume} />
            <View style={styles.modalSpacer} />
            <PrimaryButton
              title={confirmEnd ? 'Are you sure?' : 'End session'}
              onPress={handleEndRequest}
              secondary
            />
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lockInBackground,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  timer: {
    fontFamily: FontFamily.headingBold,
    fontSize: 72,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    marginBottom: 32,
    letterSpacing: -1,
  },
  phase: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
  },
  audioStatus: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
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
    ...Typography.sectionHeader,
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalSpacer: {
    height: 12,
  },
});

export default QuickLockInSessionScreen;
