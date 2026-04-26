/**
 * AppGuideSheet — Reusable first-time guide popup for any screen.
 *
 * Displays a glassmorphic bottom sheet with a title, bullet-point tips,
 * and a "Got It" dismiss button. Persists dismissal in AsyncStorage so
 * each guide only appears once.
 *
 * Usage:
 *   const guide = useAppGuide('home');
 *   ...
 *   <AppGuideSheet {...guide} title="Welcome to Home" tips={[...]} />
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../colors';
import { FontFamily } from '../typography';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Storage key helper ──────────────────────────────────────────────
const guideKey = (id: string) => `@lockedin/guide_${id}_shown`;

// ── Hook: manages visibility + AsyncStorage for a named guide ───────
export function useAppGuide(guideId: string) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(guideKey(guideId)).then((v) => {
      if (!v) setVisible(true);
    });
  }, [guideId]);

  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(guideKey(guideId), 'true').catch(() => {});
  }, [guideId]);

  return { visible, onDismiss: dismiss };
}

// ── Tip item type ───────────────────────────────────────────────────
export interface GuideTip {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  text: string;
}

// ── Component ───────────────────────────────────────────────────────
interface AppGuideSheetProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  subtitle?: string;
  tips: GuideTip[];
}

const AppGuideSheet: React.FC<AppGuideSheetProps> = ({
  visible,
  onDismiss,
  title,
  subtitle,
  tips,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible, slideAnim]);

  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [slideAnim, onDismiss]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={handleDismiss}>
        <Animated.View
          style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <View style={s.handle} />

            {/* Header */}
            <Text style={s.title}>{title}</Text>
            {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}

            {/* Tips */}
            <View style={s.tipsContainer}>
              {tips.map((tip, i) => (
                <View key={i} style={s.tipRow}>
                  <View style={[s.tipIconWrap, { backgroundColor: `${tip.iconColor ?? Colors.primary}12` }]}>
                    <Ionicons
                      name={tip.icon}
                      size={16}
                      color={tip.iconColor ?? Colors.primary}
                    />
                  </View>
                  <Text style={s.tipText}>{tip.text}</Text>
                </View>
              ))}
            </View>

            {/* Dismiss */}
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleDismiss}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Got It</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 20,
  },
  tipsContainer: {
    marginTop: 20,
    gap: 14,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: 'rgba(58,102,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(120,160,255,0.55)',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#3A66FF',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  primaryBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
});

export default AppGuideSheet;
