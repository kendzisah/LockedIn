/**
 * StreakBreakOverlay — Full-screen takeover when the user's streak just
 * reset to 0 (they missed a day). Detected reactively in HomeTab when
 * consecutiveStreak transitions from N>0 to 0.
 *
 * Shows the previous streak length, previous rank, the reset, and a
 * reassurance that XP / OVR / achievements are preserved.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { RANK_BY_ID } from '../../../design/rankTiers';
import type { RankId } from '@lockedin/shared-types';

interface StreakBreakOverlayProps {
  visible: boolean;
  previousStreakDays: number;
  previousRankId: RankId;
  onDismiss: () => void;
}

const StreakBreakOverlay: React.FC<StreakBreakOverlayProps> = ({
  visible,
  previousStreakDays,
  previousRankId,
  onDismiss,
}) => {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(12)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const reassureOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      backdropOpacity.setValue(0);
      titleOpacity.setValue(0);
      titleTranslate.setValue(12);
      cardOpacity.setValue(0);
      reassureOpacity.setValue(0);
      buttonOpacity.setValue(0);
      return;
    }

    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(titleTranslate, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }, 200),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 800),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(reassureOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 1400),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 1900),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    visible,
    backdropOpacity,
    titleOpacity,
    titleTranslate,
    cardOpacity,
    reassureOpacity,
    buttonOpacity,
  ]);

  const previousRank = RANK_BY_ID[previousRankId] ?? RANK_BY_ID.npc;
  const newRank = RANK_BY_ID.npc;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View style={[styles.root, { opacity: backdropOpacity }]}>
        <View style={styles.content}>
          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslate }],
              alignItems: 'center',
            }}
          >
            <Text style={styles.eyebrow}>STREAK BROKEN</Text>
            <Text style={styles.title}>You missed a day.</Text>
          </Animated.View>

          <Animated.View style={[styles.card, { opacity: cardOpacity }]}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Previous streak</Text>
              <Text style={styles.cardValue}>
                {previousStreakDays}{' '}
                {previousStreakDays === 1 ? 'day' : 'days'}
              </Text>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Previous rank</Text>
              <Text
                style={[
                  styles.cardValue,
                  { color: previousRank.color },
                ]}
              >
                {previousRank.name}
              </Text>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Reset to</Text>
              <Text
                style={[styles.cardValue, { color: newRank.color }]}
              >
                {newRank.name}
              </Text>
            </View>
          </Animated.View>

          <Animated.Text
            style={[styles.reassureText, { opacity: reassureOpacity }]}
          >
            Your{' '}
            <Text style={styles.reassureAccent}>
              OVR, XP, and achievements
            </Text>{' '}
            are preserved. The path is still open.
          </Animated.Text>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            style={styles.cta}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Start over</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0D12',
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 3,
    color: Colors.danger,
    marginBottom: 12,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 36,
    letterSpacing: -0.5,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  card: {
    marginTop: 32,
    width: '100%',
    backgroundColor: 'rgba(21,26,33,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.2)',
    borderRadius: 16,
    padding: 18,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  cardLabel: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  cardValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 14,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 4,
  },
  reassureText: {
    marginTop: 24,
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  reassureAccent: {
    color: Colors.success,
    fontFamily: FontFamily.bodyMedium,
  },
  buttonWrap: {
    paddingBottom: 60,
  },
  cta: {
    backgroundColor: 'rgba(58,102,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(120,160,255,0.55)',
    borderRadius: 28,
    paddingVertical: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A66FF',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: -0.1,
    color: Colors.textPrimary,
  },
});

export default StreakBreakOverlay;
