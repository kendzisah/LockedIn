/**
 * QuickLockInSessionScreen — Onboarding Lock In demo.
 *
 * Fetches the active onboarding track from Supabase (audio_tracks category='onboarding').
 * Timer matches the audio length. Falls back to 2:30 timer-only if no track exists
 * or audio fails to load.
 *
 * On background: pauses audio + timer. On return: shows resume/end modal.
 * On resume: audio + timer restart from the paused position.
 * Screen stays awake during the session via expo-keep-awake.
 *
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
import { useKeepAwake } from 'expo-keep-awake';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import { LockModeService } from '../../../services/LockModeService';
import PrimaryButton from '../../../design/components/PrimaryButton';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { Typography, FontFamily } from '../../../design/typography';
import { AudioService } from '../../../services/AudioService';
import { SessionRepository, type OnboardingTrack } from '../../../services/SessionRepository';

const FALLBACK_SECONDS = 150; // 2:30 if no onboarding track

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
  useKeepAwake();

  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);

  const endTimestampRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(1)).current;

  // ── Start / restart the tick interval from endTimestampRef ──
  const startTick = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!endTimestampRef.current) return;
      const r = Math.max(0, Math.ceil((endTimestampRef.current - Date.now()) / 1000));
      setRemaining(r);
    }, 250);
  }, []);

  const stopTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Fetch track, set duration, start timer ──
  useEffect(() => {
    let cancelled = false;

    async function loadOnboardingTrack() {
      const track: OnboardingTrack | null = await SessionRepository.getOnboardingTrack();
      if (cancelled) return;

      const duration = track?.durationSeconds && track.durationSeconds > 0
        ? track.durationSeconds
        : FALLBACK_SECONDS;

      endTimestampRef.current = Date.now() + duration * 1000;
      setTotalSeconds(duration);
      setRemaining(duration);
      startTick();

      if (track) {
        const loaded = await AudioService.load(track.signedAudioUrl);
        if (!cancelled && loaded) {
          setAudioLoaded(true);
          AudioService.play();
        }
      }
    }

    loadOnboardingTrack();

    return () => {
      cancelled = true;
      stopTick();
    };
  }, [startTick, stopTick]);

  useEffect(() => {
    return () => { AudioService.unload(); };
  }, []);

  // ── Completion ──
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !completedRef.current) {
      completedRef.current = true;
      stopTick();
      LockModeService.endSession();
      AudioService.stop();
      dispatch({ type: 'SET_DEMO_COMPLETED' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        navigation.replace('QuickLockInComplete');
      });
    }
  }, [remaining, dispatch, navigation, screenOpacity, stopTick]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      const mins = Math.ceil((totalSeconds ?? FALLBACK_SECONDS) / 60);
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

  // ── AppState: pause on background, show modal on return ──
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState !== 'active' && !paused && endTimestampRef.current && !completedRef.current) {
          // Going to background — freeze timer + pause audio
          const r = Math.max(0, Math.ceil((endTimestampRef.current - Date.now()) / 1000));
          pausedRemainingRef.current = r;
          stopTick();
          AudioService.pause();
          setPaused(true);
        } else if (nextState === 'active' && paused) {
          setShowResumeModal(true);
        }
      },
    );
    return () => subscription.remove();
  }, [paused, stopTick]);

  const handleResume = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowResumeModal(false);
    setConfirmEnd(false);
    setPaused(false);

    const frozenRemaining = pausedRemainingRef.current ?? 0;
    if (frozenRemaining <= 0) return;

    endTimestampRef.current = Date.now() + frozenRemaining * 1000;
    setRemaining(frozenRemaining);
    startTick();
    if (audioLoaded) AudioService.play();
  }, [audioLoaded, startTick]);

  const handleEndRequest = useCallback(() => {
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    completedRef.current = true;
    stopTick();
    setShowResumeModal(false);
    AudioService.stop();
    LockModeService.endSession();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.replace('QuickLockInComplete');
    });
  }, [confirmEnd, stopTick, screenOpacity, navigation]);

  const safeTotal = totalSeconds ?? FALLBACK_SECONDS;
  const safeRemaining = remaining ?? safeTotal;
  const elapsed = safeTotal - safeRemaining;

  if (totalSeconds === null) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.phase}>Preparing session…</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <View style={styles.content}>
        <Text style={styles.timer}>{formatTime(safeRemaining)}</Text>
        <Text style={styles.phase}>{getPhaseText(elapsed, safeTotal)}</Text>
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
