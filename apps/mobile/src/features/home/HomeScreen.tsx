/**
 * HomeScreen — Primary screen composing all home components.
 *
 * Layout (no ScrollView):
 * 1. AnimatedGradient — absolute base
 * 2. SafeAreaView overlay
 * 3. Top: DayOfWeekRow
 * 4. Upper third: ProgressBlock
 * 5. Center (35-40%): LockButton
 * 6. Below: StatsRow
 * 7. Bottom: IdentityCard
 *
 * Includes crash-resume interstitial modal and fade transition.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import { createSession, getRemaining } from './engine/SessionEngine';
import AnimatedGradient from './components/AnimatedGradient';
import DayOfWeekRow from './components/DayOfWeekRow';
import ProgressBlock from './components/ProgressBlock';
import LockButton from './components/LockButton';
import StatsRow from './components/StatsRow';
import IdentityCard from './components/IdentityCard';
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';

type Props = NativeStackScreenProps<MainStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { state, dispatch, isHydrated } = useSession();
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeRemaining, setResumeRemaining] = useState(0);
  const autoResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Crash-resume check on hydration ──
  useEffect(() => {
    if (!isHydrated) return;
    if (!state.activeSession) return;

    const remaining = getRemaining(state.activeSession.expectedEndTimestamp);

    if (remaining <= 0 || remaining < 10) {
      // Auto-complete silently
      dispatch({
        type: 'COMPLETE_SESSION',
        payload: { durationMinutes: state.activeSession.durationMinutes },
      });
      return;
    }

    // Show resume interstitial
    setResumeRemaining(remaining);
    setShowResumeModal(true);

    // Auto-resume after 1.5s
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

    // Navigate to session screen with resuming flag (replace to avoid stale Home in stack)
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      navigation.replace('Session', {
        duration: state.activeSession?.durationMinutes || state.sessionDurationMinutes,
        resuming: true,
      });
    });
  }, [navigation, screenOpacity, state.activeSession, state.sessionDurationMinutes]);

  const handleEndSession = useCallback(() => {
    if (autoResumeTimer.current) clearTimeout(autoResumeTimer.current);
    setShowResumeModal(false);

    if (state.activeSession) {
      dispatch({
        type: 'COMPLETE_SESSION',
        payload: { durationMinutes: state.activeSession.durationMinutes },
      });
    }
  }, [dispatch, state.activeSession]);

  // ── Lock animation complete → start session → navigate ──
  const handleLockAnimationComplete = useCallback(() => {
    const session = createSession(state.sessionDurationMinutes);

    dispatch({
      type: 'START_SESSION',
      payload: {
        startTimestamp: session.startTimestamp,
        expectedEndTimestamp: session.expectedEndTimestamp,
        durationMinutes: state.sessionDurationMinutes,
      },
    });

    // Fade to black then navigate (replace to ensure clean stack)
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.replace('Session', {
        duration: state.sessionDurationMinutes,
        resuming: false,
      });
    });
  }, [dispatch, navigation, screenOpacity, state.sessionDurationMinutes]);

  // ── Reset opacity when screen mounts or comes back into focus ──
  useEffect(() => {
    // Always start visible — handles both fresh mount (replace) and focus regain (goBack)
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
      {/* Background gradient */}
      <AnimatedGradient />

      {/* Content overlay */}
      <SafeAreaView style={styles.safeArea}>
        {/* Top: Day of week */}
        <DayOfWeekRow />

        {/* Upper: Progress block */}
        <View style={styles.progressSection}>
          <ProgressBlock />
        </View>

        {/* Center: Lock button (35-40% height) */}
        <View style={styles.lockSection}>
          <LockButton onAnimationComplete={handleLockAnimationComplete} />
        </View>

        {/* Below: Stats */}
        <StatsRow />

        {/* Bottom: Identity card */}
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
  // ── Modal ──
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
