import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { Analytics } from '../../../services/AnalyticsService';

import ScreenContainer from '../../../design/components/ScreenContainer';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const EMAIL_STORAGE_KEY = '@lockedin/user_email';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'EmailCollection'>;

const EmailCollectionScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const isValid = EMAIL_REGEX.test(email.trim());

  useEffect(() => {
    Analytics.track('Onboarding Screen Viewed', { screen: 'EmailCollection', step: 17, total_steps: 18 });
  }, []);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(20)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const inputOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(headlineOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headlineTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    timers.push(setTimeout(() => {
      Animated.timing(bodyOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 400));

    timers.push(setTimeout(() => {
      Animated.timing(inputOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 800));

    timers.push(setTimeout(() => {
      Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 1200));

    return () => timers.forEach(clearTimeout);
  }, [headlineOpacity, headlineTranslateY, bodyOpacity, inputOpacity, buttonOpacity]);

  const navigateForward = useCallback(() => {
    Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
      navigation.navigate('SignatureCommitment');
    });
  }, [screenOpacity, navigation]);

  const handleContinue = useCallback(async () => {
    if (!isValid || submitted) return;
    setSubmitted(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    const trimmed = email.trim().toLowerCase();

    try {
      await AsyncStorage.setItem(EMAIL_STORAGE_KEY, trimmed);

      // RevenueCat — subscriber attribute
      Purchases.setEmail(trimmed);

      // Mixpanel — user profile property (reserved $email)
      await Analytics.setUserProperties({ $email: trimmed });

      // AppsFlyer — additional data for attribution
      Analytics.trackAF('email_collected', { email: trimmed });

      Analytics.track('Email Collected', { source: 'onboarding' });
    } catch (e) {
      console.warn('[EmailCollection] Failed to sync email:', e);
    }

    navigateForward();
  }, [email, isValid, submitted, navigateForward]);

  const handleSkip = useCallback(() => {
    Analytics.track('Email Skipped', { source: 'onboarding' });
    navigateForward();
  }, [navigateForward]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.flex}>
              <View style={styles.body}>
                <Animated.Text
                  style={[styles.headline, { opacity: headlineOpacity, transform: [{ translateY: headlineTranslateY }] }]}
                >
                  You're in.
                </Animated.Text>

                <Animated.Text style={[styles.subtext, { opacity: bodyOpacity }]}>
                  Want personalized insights and progress updates? Drop your email below.
                </Animated.Text>

                <Animated.View style={[styles.inputWrap, { opacity: inputOpacity }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor={Colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="done"
                    onSubmitEditing={handleContinue}
                  />
                </Animated.View>
              </View>

              <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
                <TouchableOpacity
                  onPress={handleContinue}
                  activeOpacity={0.9}
                  disabled={!isValid || submitted}
                  style={[styles.ctaButton, (!isValid || submitted) && styles.ctaDisabled]}
                >
                  <Text style={[styles.ctaText, (!isValid || submitted) && styles.ctaTextDisabled]}>
                    Continue
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSkip}
                  activeOpacity={0.7}
                  style={styles.skipButton}
                >
                  <Text style={styles.skipText}>Skip for now</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, justifyContent: 'center' },
  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  subtext: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
  },
  input: {
    fontFamily: FontFamily.body,
    fontSize: 16,
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
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.55)',
  },
  ctaTextDisabled: {
    color: 'rgba(255,255,255,0.25)',
  },
  skipButton: { alignItems: 'center', paddingVertical: 8 },
  skipText: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
});

export default EmailCollectionScreen;
