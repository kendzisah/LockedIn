/**
 * MissionCompleteOverlay — Brief 1.5s confirmation toast that pops up
 * when the user marks a mission complete. Shows mission title, XP earned,
 * and (when all 3 daily missions are done) a "PERFECT EXECUTION" bonus.
 *
 * Auto-dismisses; consumer manages visible/onDismiss for each tap.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

interface MissionCompleteOverlayProps {
  visible: boolean;
  missionTitle: string;
  xp: number;
  completedCount: number;
  totalCount: number;
  /** When all daily missions just got completed by this tap. */
  isPerfectDay: boolean;
  onDismiss: () => void;
}

const VISIBLE_MS = 1500;

const MissionCompleteOverlay: React.FC<MissionCompleteOverlayProps> = ({
  visible,
  missionTitle,
  xp,
  completedCount,
  totalCount,
  isPerfectDay,
  onDismiss,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-30)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      translateY.setValue(-30);
      scale.setValue(0.9);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    const dismissTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }, VISIBLE_MS);

    return () => clearTimeout(dismissTimer);
  }, [visible, opacity, translateY, scale, onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.root} pointerEvents="none">
        <Animated.View
          style={[
            styles.toast,
            isPerfectDay && styles.toastPerfect,
            {
              opacity,
              transform: [{ translateY }, { scale }],
            },
          ]}
        >
          {isPerfectDay ? (
            <>
              <View style={styles.row}>
                <Ionicons name="trophy" size={18} color={Colors.warning} />
                <Text style={[styles.heading, { color: Colors.warning }]}>
                  ALL MISSIONS COMPLETE
                </Text>
              </View>
              <Text style={styles.bonusXp}>+50 XP BONUS</Text>
              <Text style={styles.bonusSub}>PERFECT EXECUTION.</Text>
            </>
          ) : (
            <>
              <View style={styles.row}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={[styles.heading, { color: Colors.success }]}>
                  MISSION COMPLETE
                </Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>
                {missionTitle}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.xpText}>+{xp} XP</Text>
                <Text style={styles.countText}>
                  {completedCount}/{totalCount} today
                </Text>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 80,
    alignItems: 'center',
  },
  toast: {
    minWidth: 280,
    maxWidth: '90%',
    backgroundColor: 'rgba(21,26,33,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.4)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: Colors.success,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
  },
  toastPerfect: {
    borderColor: 'rgba(255,200,87,0.5)',
    shadowColor: Colors.warning,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heading: {
    fontFamily: FontFamily.headingBold,
    fontSize: 12,
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 6,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xpText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.accent,
  },
  countText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  bonusXp: {
    marginTop: 6,
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: Colors.warning,
    textShadowColor: 'rgba(255,200,87,0.5)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  bonusSub: {
    marginTop: 2,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: Colors.textPrimary,
  },
});

export default MissionCompleteOverlay;
