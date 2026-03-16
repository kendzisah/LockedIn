/**
 * LiveSessionScreen — Onboarding 2-min Lock In demo (V2 #14).
 *
 * Preserves the existing timestamp-based timer + AppState pause/resume pattern.
 * V2 enhancements: halfway text, blue pulse at 10s, completion-pulse Lottie.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  type AppStateStatus,
  BackHandler,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import LottieView from 'lottie-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import { LockModeService } from '../../../services/LockModeService';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { Typography, FontFamily } from '../../../design/typography';
import { AudioService } from '../../../services/AudioService';
import { SessionRepository, type OnboardingTrack } from '../../../services/SessionRepository';
import { MixpanelService } from '../../../services/MixpanelService';

const FALLBACK_SECONDS = 150;

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

type Props = NativeStackScreenProps<OnboardingStackParamList, 'LiveSession'>;

const LiveSessionScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  useKeepAwake();

  useEffect(() => {
    MixpanelService.track('Onboarding Screen Viewed', { screen: 'LiveSession', step: 14, total_steps: 19 });
  }, []);

  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  const endTimestampRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const halfwayOpacity = useRef(new Animated.Value(0)).current;
  const halfwayShown = useRef(false);
  const timerPulse = useRef(new Animated.Value(1)).current;
  const pulseStarted = useRef(false);

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
    return () => { cancelled = true; stopTick(); };
  }, [startTick, stopTick]);

  useEffect(() => {
    return () => { AudioService.unload(); };
  }, []);

  // Halfway text
  useEffect(() => {
    if (remaining !== null && totalSeconds !== null && !halfwayShown.current) {
      const half = Math.floor(totalSeconds / 2);
      if (remaining <= half) {
        halfwayShown.current = true;
        Animated.timing(halfwayOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }
    }
  }, [remaining, totalSeconds, halfwayOpacity]);

  // Blue pulse at 10s
  useEffect(() => {
    if (remaining !== null && remaining <= 10 && remaining > 0 && !pulseStarted.current) {
      pulseStarted.current = true;
      Animated.loop(
        Animated.sequence([
          Animated.timing(timerPulse, { toValue: 1.08, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(timerPulse, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [remaining, timerPulse]);

  // Completion
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !completedRef.current) {
      completedRef.current = true;
      MixpanelService.track('Onboarding Session Completed', { screen: 'LiveSession', method: 'completed' });
      stopTick();
      LockModeService.endSession();
      AudioService.stop();
      dispatch({ type: 'SET_DEMO_COMPLETED' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCompletion(true);

      setTimeout(() => {
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          navigation.replace('PostSessionAffirmation');
        });
      }, 1800);
    }
  }, [remaining, dispatch, navigation, screenOpacity, stopTick]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      const mins = Math.ceil((totalSeconds ?? FALLBACK_SECONDS) / 60);
      Alert.alert('Stay Locked', `Finish the ${mins} minutes. Stay locked.`, [{ text: 'OK', style: 'cancel' }], { cancelable: false });
      return true;
    });
    return () => handler.remove();
  }, [totalSeconds]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active' && !paused && endTimestampRef.current && !completedRef.current) {
        const r = Math.max(0, Math.ceil((endTimestampRef.current - Date.now()) / 1000));
        pausedRemainingRef.current = r;
        stopTick();
        AudioService.pause();
        setPaused(true);
      } else if (nextState === 'active' && paused) {
        setShowResumeModal(true);
      }
    });
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
    if (!confirmEnd) { setConfirmEnd(true); return; }
    MixpanelService.track('Onboarding Session Completed', { screen: 'LiveSession', method: 'ended_early' });
    completedRef.current = true;
    stopTick();
    setShowResumeModal(false);
    AudioService.stop();
    LockModeService.endSession();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
      navigation.replace('PostSessionAffirmation');
    });
  }, [confirmEnd, stopTick, screenOpacity, navigation]);

  const handleSkipSession = useCallback(() => {
    MixpanelService.track('Onboarding Session Skipped', { screen: 'LiveSession' });
    completedRef.current = true;
    stopTick();
    AudioService.stop();
    LockModeService.endSession();
    Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
      navigation.replace('PostSessionAffirmation');
    });
  }, [stopTick, screenOpacity, navigation]);

  const safeTotal = totalSeconds ?? FALLBACK_SECONDS;
  const safeRemaining = remaining ?? safeTotal;
  const elapsed = safeTotal - safeRemaining;
  const isLast10 = safeRemaining <= 10 && safeRemaining > 0;

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
        <Animated.Text
          style={[
            styles.timer,
            isLast10 && styles.timerBlue,
            { transform: [{ scale: timerPulse }] },
          ]}
        >
          {formatTime(safeRemaining)}
        </Animated.Text>
        <Text style={styles.phase}>{getPhaseText(elapsed, safeTotal)}</Text>

        <Animated.Text style={[styles.halfway, { opacity: halfwayOpacity }]}>
          Halfway. You're doing it.
        </Animated.Text>

        {showCompletion && (
          <View style={styles.completionWrap}>
            <LottieView
              source={require('../../../../assets/lottie/completion-pulse.json')}
              autoPlay
              loop={false}
              style={styles.completionLottie}
            />
          </View>
        )}
      </View>

      <TouchableOpacity onPress={handleSkipSession} activeOpacity={0.7} style={styles.skipButton}>
        <Text style={styles.skipText}>Skip the session</Text>
        <Text style={styles.skipSubtext}>(most users who skip don't stick)</Text>
      </TouchableOpacity>

      <Modal visible={showResumeModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Session paused</Text>
            <Text style={styles.modalSubtext}>You left the app. Pick up where you left off.</Text>
            <TouchableOpacity onPress={handleResume} activeOpacity={0.85} style={styles.glassBtn}>
              <Text style={styles.glassBtnText}>Resume Lock In</Text>
            </TouchableOpacity>
            <View style={styles.modalSpacer} />
            <TouchableOpacity onPress={handleEndRequest} activeOpacity={0.85} style={[styles.glassBtn, styles.glassBtnSecondary]}>
              <Text style={[styles.glassBtnText, styles.glassBtnTextSecondary]}>{confirmEnd ? 'Are you sure?' : 'End session'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lockInBackground },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  timer: {
    fontFamily: FontFamily.headingBold,
    fontSize: 72,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    marginBottom: 32,
    letterSpacing: -1,
  },
  timerBlue: { color: Colors.primary },
  phase: { ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center', lineHeight: 28 },
  halfway: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 24,
    textAlign: 'center',
  },
  completionWrap: {
    position: 'absolute',
    width: 200,
    height: 200,
  },
  completionLottie: { width: 200, height: 200 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  modalCard: { backgroundColor: Colors.backgroundSecondary, borderRadius: 16, padding: 28, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: Colors.surface },
  modalTitle: { ...Typography.sectionHeader, color: Colors.textPrimary, marginBottom: 12, textAlign: 'center' },
  modalSubtext: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  modalSpacer: { height: 12 },
  glassBtn: { backgroundColor: 'rgba(255,255,255,0.04)', paddingVertical: 16, borderRadius: 28, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  glassBtnSecondary: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.06)' },
  glassBtnText: { fontFamily: FontFamily.headingSemiBold, fontSize: 17, letterSpacing: 0.5, color: 'rgba(255,255,255,0.55)' },
  glassBtnTextSecondary: { color: 'rgba(255,255,255,0.35)' },
  skipButton: { paddingBottom: 48, paddingTop: 12, alignItems: 'center', opacity: 0.5 },
  skipText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.textMuted },
  skipSubtext: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});

export default LiveSessionScreen;
