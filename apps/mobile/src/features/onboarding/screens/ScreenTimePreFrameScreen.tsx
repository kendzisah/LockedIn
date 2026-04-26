import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import { Analytics } from '../../../services/AnalyticsService';
import { PermissionService } from '../../../services/PermissionService';
import { LockModeService } from '../../../services/LockModeService';
import ScreenContainer from '../../../design/components/ScreenContainer';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 20;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ScreenTimePreFrame'>;

const ScreenTimePreFrameScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const bodyTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const privacyOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const deniedOpacity = useRef(new Animated.Value(0)).current;

  useOnboardingTracking('ScreenTimePreFrame');

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(headlineOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headlineTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 400));

    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(bodyOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(bodyTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 1000));

    timers.push(setTimeout(() => {
      Animated.timing(privacyOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 1600));

    timers.push(setTimeout(() => {
      Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 2000));

    return () => timers.forEach(clearTimeout);
  }, [headlineOpacity, headlineTranslateY, bodyOpacity, bodyTranslateY, privacyOpacity, buttonOpacity]);

  const navigateForward = useCallback(() => {
    Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
      navigation.navigate('NotificationPreFrame');
    });
  }, [screenOpacity, navigation]);

  const handleGrantAccess = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const status = await PermissionService.requestScreenTimePermission();
      dispatch({ type: 'SET_SCREEN_TIME_STATUS', payload: status });

      if (status === 'granted') {
        Analytics.track('Permission Granted', { screen: 'ScreenTimePreFrame', permission: 'screen_time' });
        await LockModeService.showAppPicker();
        navigateForward();
      } else {
        Analytics.track('Permission Denied', { screen: 'ScreenTimePreFrame', permission: 'screen_time' });
        setDenied(true);
        Animated.timing(deniedOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }
    } finally {
      setLoading(false);
    }
  }, [loading, dispatch, navigateForward, deniedOpacity]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer>

        <View style={styles.body}>
          <View style={styles.lottieWrap}>
            <LottieView
              source={require('../../../../assets/lottie/lock_close.json')}
              autoPlay
              loop={false}
              style={styles.lottie}
            />
          </View>

          <Animated.Text
            style={[styles.headline, { opacity: headlineOpacity, transform: [{ translateY: headlineTranslateY }] }]}
          >
            No exits means no loopholes.
          </Animated.Text>

          <Animated.View style={{ opacity: bodyOpacity, transform: [{ translateY: bodyTranslateY }] }}>
            <Text style={styles.bodyText}>
              To enforce your blocks, Locked In needs access to Screen Time.
            </Text>
            <Text style={styles.privacyNote}>
              100% private. No tracking, no data collection.
            </Text>
            <Text style={styles.trustLine}>
              Your data never leaves this device —{'\n'}it's protected by Apple, not us.
            </Text>
          </Animated.View>

          <View style={styles.dialogPreview}>
            <Text style={styles.dialogTitle}>
              "Locked In" Would Like to Access Screen Time
            </Text>
            <Text style={styles.dialogBody}>
              This allows Locked In to enforce focus blocks on your device.
            </Text>
          </View>

          {denied && (
            <Animated.View style={{ opacity: deniedOpacity, marginTop: 16 }}>
              <Text style={styles.deniedText}>
                Screen Time is required for full focus enforcement.
              </Text>
            </Animated.View>
          )}
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={handleGrantAccess}
            activeOpacity={0.9}
            style={styles.ctaButton}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="rgba(255,255,255,0.55)" size="small" />
            ) : (
              <Text style={styles.ctaText}>
                {denied ? 'Try Again' : 'Connect Securely'}
              </Text>
            )}
          </TouchableOpacity>

          {denied && (
            <TouchableOpacity
              onPress={navigateForward}
              activeOpacity={0.7}
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>Continue anyway (limited)</Text>
            </TouchableOpacity>
          )}

        </Animated.View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center' },
  lottieWrap: { width: 64, height: 64, marginBottom: 20 },
  lottie: { width: 64, height: 64 },
  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 34,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  bodyText: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  privacyNote: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    opacity: 0.7,
  },
  trustLine: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  dialogPreview: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    opacity: 0.7,
    padding: 16,
    marginTop: 24,
    alignItems: 'center',
  },
  dialogTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  dialogBody: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  deniedText: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.danger,
  },
  buttonWrap: { paddingBottom: 32, paddingHorizontal: 4 },
  ctaButton: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.55)',
  },
  skipButton: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.textMuted },
});

export default ScreenTimePreFrameScreen;
