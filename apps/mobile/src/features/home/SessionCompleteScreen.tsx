/**
 * SessionCompleteScreen — Phase-specific completion messages + streak celebration.
 *
 * Shows an identity-reinforcing message for the session type, then (for Lock In only)
 * a flame animation that transitions into the streak number with checkpoint copy.
 * Auto-navigates to Home after ~4s or on tap.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { getCompletionMessage, getStreakCheckpoint } from './engine/CompletionCopy';
import { Colors } from '../../design/colors';
import { FontFamily } from '../../design/typography';

type Props = NativeStackScreenProps<MainStackParamList, 'SessionComplete'>;

const SessionCompleteScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phase, durationMinutes, streak } = route.params;
  const [dismissed, setDismissed] = useState(false);

  const message = useRef(getCompletionMessage(phase)).current;
  const checkpoint = useRef(getStreakCheckpoint(streak)).current;

  // Animation values
  const messageOpacity = useRef(new Animated.Value(0)).current;
  const streakOpacity = useRef(new Animated.Value(0)).current;
  const [showStreak, setShowStreak] = useState(false);

  const showStreakCelebration = phase === 'execution_block' && streak > 0;

  const navigateHome = useCallback(() => {
    if (dismissed) return;
    setDismissed(true);
    navigation.replace('Home');
  }, [dismissed, navigation]);

  useEffect(() => {
    // Phase 1: fade in message
    Animated.timing(messageOpacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    if (showStreakCelebration) {
      // After 2.5s, fade out message and show streak
      const streakTimer = setTimeout(() => {
        Animated.timing(messageOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          setShowStreak(true);
          Animated.timing(streakOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }).start();
        });
      }, 2500);

      // Auto-dismiss after 7s total for streak celebrations
      const autoDismiss = setTimeout(navigateHome, 7000);

      return () => {
        clearTimeout(streakTimer);
        clearTimeout(autoDismiss);
      };
    }

    // Non-streak sessions: auto-dismiss after 4s
    const autoDismiss = setTimeout(navigateHome, 4000);
    return () => clearTimeout(autoDismiss);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TouchableWithoutFeedback onPress={navigateHome}>
      <View style={styles.container}>
        {/* Phase completion message */}
        {!showStreak && (
          <Animated.View style={[styles.centerContent, { opacity: messageOpacity }]}>
            <Text style={styles.messageText}>{message}</Text>
            {phase === 'execution_block' && (
              <Text style={styles.durationText}>
                {durationMinutes} minute{durationMinutes !== 1 ? 's' : ''} executed.
              </Text>
            )}
          </Animated.View>
        )}

        {/* Streak celebration (Lock In only) */}
        {showStreak && showStreakCelebration && (
          <Animated.View style={[styles.centerContent, { opacity: streakOpacity }]}>
            <LottieView
              source={require('../../../assets/lottie/fire.json')}
              autoPlay
              loop
              style={styles.flameLottie}
            />
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakDetail}>{checkpoint.detail}</Text>
            <Text style={styles.streakHeadline}>{checkpoint.headline}</Text>
            <Text style={styles.streakSub}>{checkpoint.sub}</Text>
            {checkpoint.showWarning && (
              <Text style={styles.streakWarning}>
                Miss one day, and the pattern resets.
              </Text>
            )}
          </Animated.View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lockInBackground,
  },
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  messageText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  durationText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
    letterSpacing: 0.2,
  },
  flameLottie: {
    width: 120,
    height: 120,
    marginBottom: 8,
  },
  streakNumber: {
    fontFamily: FontFamily.headingBold,
    fontSize: 64,
    color: Colors.textPrimary,
    letterSpacing: -2,
    marginBottom: 4,
  },
  streakDetail: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  streakHeadline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  streakSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  streakWarning: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.6,
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
});

export default SessionCompleteScreen;
