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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../types/navigation';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const NUDGE_KEY = '@lockedin/signup_nudge_streak3_shown';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SignUpNudgeSheetProps {
  visible: boolean;
  streak: number;
  onDismiss: () => void;
}

const SignUpNudgeSheet: React.FC<SignUpNudgeSheetProps> = ({
  visible,
  streak,
  onDismiss,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
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

  const dismiss = useCallback(async () => {
    await AsyncStorage.setItem(NUDGE_KEY, 'true').catch(() => {});
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [slideAnim, onDismiss]);

  const handleSecure = useCallback(async () => {
    await AsyncStorage.setItem(NUDGE_KEY, 'true').catch(() => {});
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
      navigation.navigate('SignUp');
    });
  }, [slideAnim, onDismiss, navigation]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={dismiss}>
        <Animated.View
          style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />

            <Text style={s.callout}>🔥 {streak}-day streak!</Text>
            <Text style={s.message}>
              You're building real momentum. Create a free account so you never
              lose it.
            </Text>

            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleSecure}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Secure My Streak</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={dismiss} style={s.dismissBtn}>
              <Text style={s.dismissText}>Not now</Text>
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
  callout: {
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
    color: Colors.textPrimary,
  },
  message: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 8,
    lineHeight: 22,
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.25)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    color: Colors.primary,
  },
  dismissBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
});

export default SignUpNudgeSheet;
