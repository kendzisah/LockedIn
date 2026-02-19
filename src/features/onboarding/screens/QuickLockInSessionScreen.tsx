import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
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

const TOTAL_SECONDS = 120;

function getPhaseText(elapsed: number): string {
  if (elapsed < 30) return 'Breathe. Control your body.';
  if (elapsed < 90) return 'Identity: You do what you said you would do.';
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
  const [remaining, setRemaining] = useState(TOTAL_SECONDS);
  const [paused, setPaused] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // --- Timer logic ---
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

  // Start on mount
  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [startTimer, stopTimer]);

  // --- Completion ---
  useEffect(() => {
    if (remaining === 0) {
      LockModeService.endSession();
      dispatch({ type: 'SET_DEMO_COMPLETED' });
      navigation.replace('QuickLockInComplete');
    }
  }, [remaining, dispatch, navigation]);

  // --- Android back handler ---
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Stay Locked',
        'Finish the 2 minutes. Stay locked.',
        [{ text: 'OK', style: 'cancel' }],
        { cancelable: false },
      );
      return true;
    });
    return () => handler.remove();
  }, []);

  // --- AppState handler ---
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const wasActive = appStateRef.current === 'active';
        const isActive = nextState === 'active';

        if (wasActive && !isActive) {
          stopTimer();
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
  };

  const handleEndRequest = () => {
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    setShowResumeModal(false);
    setPaused(false);
    stopTimer();
    LockModeService.endSession();
    navigation.replace('QuickLockInComplete');
  };

  const elapsed = TOTAL_SECONDS - remaining;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.timer}>{formatTime(remaining)}</Text>
        <Text style={styles.phase}>{getPhaseText(elapsed)}</Text>
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
    </View>
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
