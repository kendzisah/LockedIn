/**
 * RankUpOverlay — Full-screen takeover when the user crosses a rank
 * threshold. Triggered by SessionCompleteScreen via RankService.detectRankChange.
 *
 * Sequence:
 *   1. Backdrop fades in
 *   2. Rank-color radial glow expands from centre
 *   3. "RANK UP" eyebrow + new rank name pop in (large)
 *   4. Heavy haptic
 *   5. Continue button appears after 2s
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { RankTier } from '../../../design/rankTiers';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

interface RankUpOverlayProps {
  visible: boolean;
  fromRank: RankTier;
  toRank: RankTier;
  onDismiss: () => void;
}

const RankUpOverlay: React.FC<RankUpOverlayProps> = ({
  visible,
  fromRank,
  toRank,
  onDismiss,
}) => {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const eyebrowOpacity = useRef(new Animated.Value(0)).current;
  const rankOpacity = useRef(new Animated.Value(0)).current;
  const rankScale = useRef(new Animated.Value(0.7)).current;
  const fromOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      backdropOpacity.setValue(0);
      glowScale.setValue(0);
      glowOpacity.setValue(0);
      eyebrowOpacity.setValue(0);
      rankOpacity.setValue(0);
      rankScale.setValue(0.7);
      fromOpacity.setValue(0);
      buttonOpacity.setValue(0);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(glowOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();

        Animated.timing(eyebrowOpacity, {
          toValue: 1,
          duration: 400,
          delay: 200,
          useNativeDriver: true,
        }).start();

        Animated.parallel([
          Animated.timing(rankOpacity, {
            toValue: 1,
            duration: 600,
            delay: 400,
            useNativeDriver: true,
          }),
          Animated.spring(rankScale, {
            toValue: 1,
            friction: 6,
            tension: 70,
            delay: 400,
            useNativeDriver: true,
          }),
        ]).start();

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        timers.push(
          setTimeout(
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
            200,
          ),
        );

        Animated.timing(fromOpacity, {
          toValue: 1,
          duration: 500,
          delay: 1100,
          useNativeDriver: true,
        }).start();

        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          delay: 1800,
          useNativeDriver: true,
        }).start();
      }, 100),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    visible,
    backdropOpacity,
    glowScale,
    glowOpacity,
    eyebrowOpacity,
    rankOpacity,
    rankScale,
    fromOpacity,
    buttonOpacity,
  ]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View style={[styles.root, { opacity: backdropOpacity }]}>
        {/* Radial glow in the new rank's color */}
        <Animated.View
          style={[
            styles.glow,
            {
              backgroundColor: toRank.color,
              opacity: glowOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.18],
              }),
              transform: [{ scale: glowScale }],
            },
          ]}
          pointerEvents="none"
        />

        <View style={styles.content}>
          <Animated.Text style={[styles.eyebrow, { opacity: eyebrowOpacity }]}>
            RANK UP
          </Animated.Text>

          <Animated.Text
            style={[
              styles.rankName,
              {
                color: toRank.color,
                textShadowColor: `${toRank.color}AA`,
                opacity: rankOpacity,
                transform: [{ scale: rankScale }],
              },
            ]}
          >
            {toRank.name}
          </Animated.Text>

          <Animated.View style={[styles.fromRow, { opacity: fromOpacity }]}>
            <Text style={styles.fromText}>You are no longer </Text>
            <Text style={[styles.fromRank, { color: fromRank.color }]}>
              {fromRank.name}
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            style={[
              styles.cta,
              {
                borderColor: `${toRank.color}88`,
                shadowColor: toRank.color,
              },
            ]}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Continue</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    top: '20%',
  },
  content: {
    alignItems: 'center',
    zIndex: 1,
  },
  eyebrow: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    letterSpacing: 4,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  rankName: {
    fontFamily: FontFamily.headingBold,
    fontSize: 56,
    letterSpacing: -0.5,
    textShadowRadius: 24,
    textShadowOffset: { width: 0, height: 0 },
    textAlign: 'center',
  },
  fromRow: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fromText: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textMuted,
  },
  fromRank: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  buttonWrap: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
  },
  cta: {
    borderRadius: 28,
    paddingVertical: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: -0.1,
    color: Colors.textPrimary,
  },
});

export default RankUpOverlay;
