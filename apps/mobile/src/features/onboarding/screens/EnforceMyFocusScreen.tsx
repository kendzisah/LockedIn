import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { LockModeService } from '../../../services/LockModeService';
import { MixpanelService } from '../../../services/MixpanelService';
import { SessionRepository } from '../../../services/SessionRepository';
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 25;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'EnforceMyFocus'>;

const EnforceMyFocusScreen: React.FC<Props> = ({ navigation }) => {
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    MixpanelService.track('Onboarding Screen Viewed', { screen: 'EnforceMyFocus', step: 13, total_steps: 19 });
  }, []);

  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const ruleOpacity = useRef(new Animated.Value(0)).current;
  const ruleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const doctrineOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    SessionRepository.prefetchOnboardingTrack();
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(headlineOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(headlineTranslateY, { toValue: 0, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(ruleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(ruleTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 1200));

    timers.push(setTimeout(() => {
      Animated.timing(doctrineOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 2200));

    timers.push(setTimeout(() => {
      Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweepAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(2000),
        ]),
      ).start();
    }, 3200));

    return () => timers.forEach(clearTimeout);
  }, [headlineOpacity, headlineTranslateY, ruleOpacity, ruleTranslateY, doctrineOpacity, buttonOpacity, sweepAnim]);

  const handleLockIn = useCallback(() => {
    LockModeService.beginSession();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 1, duration: 75, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 75, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.timing(screenOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        navigation.navigate('LiveSession');
      });
    }, 150);
  }, [navigation, screenOpacity, flashOpacity]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer>
        <ProgressIndicator current={14} total={19} />

        <View style={styles.body}>
          <Animated.Text
            style={[styles.title, { opacity: headlineOpacity, transform: [{ translateY: headlineTranslateY }] }]}
          >
            Your First Lock In{'\n'}Starts Now.
          </Animated.Text>

          <Animated.Text
            style={[styles.rule, { opacity: ruleOpacity, transform: [{ translateY: ruleTranslateY }] }]}
          >
            2 minutes. No exits.
          </Animated.Text>

          <Animated.Text style={[styles.doctrine, { opacity: doctrineOpacity }]}>
            This is the standard.
          </Animated.Text>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={handleLockIn}
            activeOpacity={0.9}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Lock In</Text>

            <Animated.View
              style={[
                styles.shineOverlay,
                {
                  transform: [
                    {
                      translateX: sweepAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-160, 400],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[
                  'transparent',
                  'rgba(255,255,255,0.35)',
                  'transparent',
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </ScreenContainer>

      <Animated.View style={[styles.flashOverlay, { opacity: flashOpacity }]} pointerEvents="none" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center' },
  title: { fontFamily: FontFamily.headingBold, fontSize: 36, letterSpacing: -0.8, lineHeight: 42, color: Colors.textPrimary, marginBottom: 16 },
  rule: { fontFamily: FontFamily.bodyMedium, fontSize: 16, lineHeight: 22, color: Colors.textSecondary, marginBottom: 12 },
  doctrine: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, color: Colors.textMuted, letterSpacing: 0.5, opacity: 0.6 },
  buttonWrap: { paddingBottom: 32, paddingHorizontal: 4 },
  ctaButton: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
  },
  shineOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 120,
  },
  flashOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000' },
});

export default EnforceMyFocusScreen;
