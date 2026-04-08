import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

export interface StreakRecoveryModalProps {
  visible: boolean;
  streak: number;
  recoveriesRemaining: number;
  onSavePress: () => void;
  onDismiss: () => void;
}

export const StreakRecoveryModal: React.FC<StreakRecoveryModalProps> = ({
  visible,
  streak,
  recoveriesRemaining,
  onSavePress,
  onDismiss,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.centeredView}>
          <View style={styles.modalCard}>
            {/* Header */}
            <Text style={styles.heading}>Your streak is at risk!</Text>

            {/* Description */}
            <Text style={styles.description}>
              Complete a 15-minute focus session to save your {streak}-day streak
            </Text>

            {/* Recoveries Remaining */}
            <View style={styles.recoveryInfo}>
              <Text style={styles.recoveryText}>
                {recoveriesRemaining} {recoveriesRemaining === 1 ? 'recovery' : 'recoveries'} remaining this week
              </Text>
            </View>

            {/* Save My Streak Button (Primary) */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onSavePress}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Save My Streak</Text>
            </TouchableOpacity>

            {/* Let It Reset Button (Secondary) */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onDismiss}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Let It Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalCard: {
    width: '85%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  heading: {
    fontSize: 24,
    fontFamily: FontFamily.heading,
    color: Colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    fontFamily: FontFamily.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  recoveryInfo: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  recoveryText: {
    fontSize: 14,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textPrimary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textMuted,
  },
});
