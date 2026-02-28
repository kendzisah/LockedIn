import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import { PermissionService } from '../../../services/PermissionService';
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 20;

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'NotificationPermission'
>;

const NotificationPermissionScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  const [denied, setDenied] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ── Screen-level fade ──
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // ── Content stagger ──
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const dividerOpacity = useRef(new Animated.Value(0)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const bodyTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // ── Denied state ──
  const deniedOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Headline at 200ms (slightly faster — this is a softer screen)
    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(headlineOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(headlineTranslateY, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }, 200),
    );

    // Divider at 600ms
    timers.push(
      setTimeout(() => {
        Animated.timing(dividerOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 600),
    );

    // Body at 900ms
    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(bodyOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(bodyTranslateY, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }, 900),
    );

    // Button at 1600ms
    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 1600),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    headlineOpacity,
    headlineTranslateY,
    dividerOpacity,
    bodyOpacity,
    bodyTranslateY,
    buttonOpacity,
  ]);

  const fadeAndNavigate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('QuickLockInIntro');
    });
  }, [screenOpacity, navigation]);

  const handleRequest = useCallback(async () => {
    const granted = await PermissionService.requestNotificationPermission();
    dispatch({ type: 'SET_NOTIFICATIONS_GRANTED', payload: granted });

    if (granted) {
      fadeAndNavigate();
    } else {
      setDenied(true);
      Animated.timing(deniedOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [dispatch, deniedOpacity, fadeAndNavigate]);

  const handleContinueAfterDeny = useCallback(() => {
    fadeAndNavigate();
  }, [fadeAndNavigate]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
    <ScreenContainer>
      <ProgressIndicator current={10} total={13} />

      <View style={styles.body}>
        {/* Headline */}
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: headlineOpacity,
              transform: [{ translateY: headlineTranslateY }],
            },
          ]}
        >
          Daily execution.
        </Animated.Text>

        {/* Thin divider */}
        <Animated.View style={[styles.divider, { opacity: dividerOpacity }]} />

        {/* Body — supportive, not forceful */}
        <Animated.View
          style={{
            opacity: bodyOpacity,
            transform: [{ translateY: bodyTranslateY }],
          }}
        >
          <Text style={styles.bodyLine}>
            We'll signal your Lock In time.
          </Text>
          <Text style={styles.bodyEmphasis}>You show up.</Text>
        </Animated.View>

        {/* Denied fallback */}
        {denied && (
          <Animated.Text style={[styles.deniedNote, { opacity: deniedOpacity }]}>
            No problem. You can enable this anytime in Settings.
          </Animated.Text>
        )}
      </View>

      {/* CTA */}
      <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
        {!denied ? (
          <TouchableOpacity
            onPress={handleRequest}
            activeOpacity={0.9}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Commit to Daily Lock In</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleContinueAfterDeny}
            activeOpacity={0.9}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  // ── Headline ──
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 34,
    color: Colors.textPrimary,
  },
  divider: {
    width: 28,
    height: 2,
    backgroundColor: Colors.primary,
    marginTop: 14,
    marginBottom: 18,
    opacity: 0.5,
  },
  // ── Body — clean, supportive ──
  bodyLine: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  bodyEmphasis: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
    marginTop: 6,
  },
  // ── Denied ──
  deniedNote: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    marginTop: 20,
    opacity: 0.7,
  },
  // ── CTA ──
  buttonWrap: {
    paddingBottom: 32,
    paddingHorizontal: 4,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 6,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    letterSpacing: 0.2,
    color: Colors.textPrimary,
  },
});

export default NotificationPermissionScreen;
