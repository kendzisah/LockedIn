import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { PermissionService } from '../../../services/PermissionService';
import { NotificationService } from '../../../services/NotificationService';
import { MixpanelService } from '../../../services/MixpanelService';
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 20;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NotificationPreFrame'>;

const NotificationPreFrameScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();

  useEffect(() => {
    MixpanelService.track('Onboarding Screen Viewed', { screen: 'NotificationPreFrame', step: 15, total_steps: 18 });
  }, []);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const bodyTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

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
      Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 1600));

    return () => timers.forEach(clearTimeout);
  }, [headlineOpacity, headlineTranslateY, bodyOpacity, bodyTranslateY, buttonOpacity]);

  const navigateForward = useCallback(() => {
    Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
      navigation.navigate('PersonalizedPlanCard');
    });
  }, [screenOpacity, navigation]);

  const handleTurnOn = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const granted = await PermissionService.requestNotificationPermission();
    if (granted) {
      MixpanelService.track('Permission Granted', { screen: 'NotificationPreFrame', permission: 'notifications' });
      await NotificationService.scheduleAllDailyNotifications(0);
    } else {
      MixpanelService.track('Permission Denied', { screen: 'NotificationPreFrame', permission: 'notifications' });
    }
    dispatch({ type: 'SET_NOTIFICATIONS_GRANTED', payload: granted });
    navigateForward();
  }, [dispatch, navigateForward]);

  const handleSkip = useCallback(() => {
    MixpanelService.track('Permission Skipped', { screen: 'NotificationPreFrame', permission: 'notifications' });
    dispatch({ type: 'SET_NOTIFICATIONS_GRANTED', payload: false });
    navigateForward();
  }, [dispatch, navigateForward]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer>
        <ProgressIndicator current={17} total={19} />

        <View style={styles.body}>
          <View style={styles.lottieWrap}>
            <LottieView
              source={require('../../../../assets/lottie/bell-ring.json')}
              autoPlay
              loop={false}
              style={styles.lottie}
              colorFilters={[
                { keypath: 'bell Outlines 2', color: '#FFFFFF' },
                { keypath: 'bell Outlines', color: '#FFFFFF' },
              ]}
            />
          </View>

          <Animated.Text
            style={[styles.headline, { opacity: headlineOpacity, transform: [{ translateY: headlineTranslateY }] }]}
          >
            We'll signal your session.{'\n'}You show up.
          </Animated.Text>

          <Animated.View style={{ opacity: bodyOpacity, transform: [{ translateY: bodyTranslateY }] }}>
            <Text style={styles.bodyText}>
              Daily Lock In notifications are your trigger.
            </Text>
            <Text style={styles.anchor}>
              Miss the trigger, miss the session.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={handleTurnOn}
            activeOpacity={0.9}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Turn On Daily Signal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Skip (not recommended)</Text>
          </TouchableOpacity>
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
    marginBottom: 8,
  },
  anchor: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
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

export default NotificationPreFrameScreen;
