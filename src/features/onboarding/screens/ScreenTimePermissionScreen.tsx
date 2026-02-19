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
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 20;

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'ScreenTimePermission'
>;

const ScreenTimePermissionScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ── Pulse ring ──
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.5)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  // ── Content stagger ──
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const bodyTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const reassureOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // ── Transition phase ──
  const transitionOpacity = useRef(new Animated.Value(0)).current;
  const transitionScale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Dot fades in
    Animated.timing(dotOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Continuous pulse ring — expands and fades out, then resets
    Animated.loop(
      Animated.parallel([
        Animated.timing(pulseScale, {
          toValue: 2.8,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Headline at 400ms
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
      }, 400),
    );

    // Body at 1000ms
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
      }, 1000),
    );

    // Reassurance at 1800ms
    timers.push(
      setTimeout(() => {
        Animated.timing(reassureOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 1800),
    );

    // Button at 2400ms
    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 2400),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    dotOpacity,
    pulseScale,
    pulseOpacity,
    headlineOpacity,
    headlineTranslateY,
    bodyOpacity,
    bodyTranslateY,
    reassureOpacity,
    buttonOpacity,
  ]);

  const handleRequest = useCallback(async () => {
    const status = await PermissionService.requestScreenTimePermission();
    dispatch({ type: 'SET_SCREEN_TIME_STATUS', payload: status });

    setIsTransitioning(true);

    // Fade out all current content
    Animated.parallel([
      Animated.timing(dotOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(headlineOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(bodyOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(reassureOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      // Fade in confirmation text
      Animated.parallel([
        Animated.timing(transitionOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(transitionScale, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hold, then navigate
        setTimeout(() => {
          navigation.navigate('NotificationPermission');
        }, 1800);
      });
    });
  }, [
    navigation,
    dispatch,
    dotOpacity,
    headlineOpacity,
    bodyOpacity,
    reassureOpacity,
    buttonOpacity,
    transitionOpacity,
    transitionScale,
  ]);

  return (
    <ScreenContainer>
      <ProgressIndicator current={5} total={8} />

      {!isTransitioning ? (
        <>
          <View style={styles.body}>
            {/* Subtle animated pulse ring */}
            <View style={styles.pulseWrap}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              />
              <Animated.View style={[styles.pulseDot, { opacity: dotOpacity }]} />
            </View>

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
              Let us enforce your{'\n'}commitment.
            </Animated.Text>

            {/* Divider */}
            <Animated.View
              style={[styles.divider, { opacity: headlineOpacity }]}
            />

            {/* Body — tactical, not explanatory */}
            <Animated.View
              style={{
                opacity: bodyOpacity,
                transform: [{ translateY: bodyTranslateY }],
              }}
            >
              <Text style={styles.bodyLine}>
                During Lock In, selected apps are blocked.
              </Text>
              <Text style={styles.bodyLine}>
                No notifications. No exits. No loopholes.
              </Text>
              <Text style={styles.bodyEmphasis}>
                Focus becomes non-negotiable.
              </Text>
            </Animated.View>

            {/* Micro-reassurance */}
            <Animated.Text style={[styles.reassure, { opacity: reassureOpacity }]}>
              Only active during Lock In sessions.
            </Animated.Text>
          </View>

          {/* CTA */}
          <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
            <TouchableOpacity
              onPress={handleRequest}
              activeOpacity={0.9}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Enforce My Focus</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      ) : (
        /* Transition page — confirmation centered */
        <View style={styles.transitionCenter}>
          <Animated.Text
            style={[
              styles.transitionText,
              {
                opacity: transitionOpacity,
                transform: [{ scale: transitionScale }],
              },
            ]}
          >
            Enforcement will activate{'\n'}after your trial starts.
          </Animated.Text>
        </View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  // ── Subtle animated pulse ring ──
  pulseWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  pulseRing: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.textSecondary,
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
  // ── Body — tactical lines ──
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
    marginTop: 8,
  },
  // ── Micro-reassurance ──
  reassure: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textMuted,
    marginTop: 16,
    letterSpacing: 0.3,
    opacity: 0.6,
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
  // ── Transition page ──
  transitionCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  transitionText: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    letterSpacing: -0.3,
    lineHeight: 32,
    color: Colors.primary,
    textAlign: 'center',
  },
});

export default ScreenTimePermissionScreen;
