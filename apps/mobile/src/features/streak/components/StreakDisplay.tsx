import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ViewStyle,
} from 'react-native';

const Colors = {
  background: '#0E1116',
  backgroundSecondary: '#151A21',
  surface: '#2C3440',
  primary: '#3A66FF',
  accent: '#00C2FF',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  danger: '#FF4757',
};

const FontFamily = {
  headingBold: 'InterTight_800ExtraBold',
  heading: 'InterTight_700Bold',
  headingSemiBold: 'InterTight_600SemiBold',
  bodyMedium: 'Inter_500Medium',
  body: 'Inter_400Regular',
};

export interface StreakDisplayProps {
  streak: number;
  onRecoveryPress: () => void;
  recoveryAvailable: boolean;
  wasRecovered?: boolean;
}

export const StreakDisplay: React.FC<StreakDisplayProps> = ({
  streak,
  onRecoveryPress,
  recoveryAvailable,
  wasRecovered = false,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (streak === 0 && recoveryAvailable) {
      // Start pulsing animation for the "Save Your Streak" button
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [streak, recoveryAvailable, pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Flame Icon */}
      <Text style={styles.flameIcon}>🔥</Text>

      {/* Streak Number */}
      <Text style={styles.streakNumber}>{streak}</Text>

      {/* Label */}
      <Text style={styles.label}>day streak</Text>

      {/* Recovered Badge */}
      {wasRecovered && (
        <View style={styles.recoveredBadge}>
          <Text style={styles.recoveredText}>Recovered</Text>
        </View>
      )}

      {/* Save Your Streak Button (shown when streak is 0 and recovery available) */}
      {streak === 0 && recoveryAvailable && (
        <Animated.View
          style={[
            styles.saveStreakButtonContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.saveStreakButton}
            onPress={onRecoveryPress}
            activeOpacity={0.8}
          >
            <Text style={styles.saveStreakButtonText}>Save Your Streak</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    position: 'relative',
  },
  flameIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  streakNumber: {
    fontSize: 72,
    fontFamily: FontFamily.headingBold,
    color: Colors.textPrimary,
    lineHeight: 80,
    marginBottom: 4,
  },
  label: {
    fontSize: 16,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  recoveredBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.accent,
    borderRadius: 12,
  },
  recoveredText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.background,
  },
  saveStreakButtonContainer: {
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 16,
  },
  saveStreakButton: {
    backgroundColor: Colors.danger,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveStreakButtonText: {
    fontSize: 16,
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textPrimary,
  },
});
