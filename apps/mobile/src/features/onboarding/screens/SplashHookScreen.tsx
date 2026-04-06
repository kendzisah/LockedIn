import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../../design/colors';
import { Typography } from '../../../design/typography';
import { Analytics } from '../../../services/AnalyticsService';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SplashHook'>;

const SplashHookScreen: React.FC<Props> = ({ navigation }) => {
  useEffect(() => {
    Analytics.track('Onboarding Screen Viewed', { screen: 'SplashHook', step: 2, total_steps: 18 });
  }, []);

  const [phase, setPhase] = useState<'intro' | 'transition'>('intro');
  const transitioned = useRef(false);

  const titlePart1Opacity = useRef(new Animated.Value(0)).current;
  const titlePart2Opacity = useRef(new Animated.Value(0)).current;
  const middleOpacity = useRef(new Animated.Value(0)).current;

  const introOpacity = useRef(new Animated.Value(1)).current;

  const awarenessOpacity = useRef(new Animated.Value(0)).current;
  const awarenessScale = useRef(new Animated.Value(0.9)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const shineTranslate = useRef(new Animated.Value(0)).current;
  const [shineActive, setShineActive] = useState(false);

  useEffect(() => {
    if (!shineActive) return;
    let cancelled = false;
    const runShine = () => {
      if (cancelled) return;
      shineTranslate.setValue(0);
      Animated.sequence([
        Animated.delay(2500),
        Animated.timing(shineTranslate, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) runShine();
      });
    };
    runShine();
    return () => { cancelled = true; };
  }, [shineActive, shineTranslate]);

  useEffect(() => {
    Animated.timing(titlePart1Opacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    const part2Timer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.timing(titlePart2Opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 1400);

    const middleTimer = setTimeout(() => {
      Animated.timing(middleOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 2100);

    const autoTimer = setTimeout(() => {
      triggerTransition();
    }, 3500);

    return () => {
      clearTimeout(part2Timer);
      clearTimeout(middleTimer);
      clearTimeout(autoTimer);
    };
  }, []);

  const triggerTransition = useCallback(() => {
    if (transitioned.current) return;
    transitioned.current = true;
    setPhase('transition');

    Animated.timing(introOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      Animated.parallel([
        Animated.timing(awarenessOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(awarenessScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          delay: 600,
          useNativeDriver: true,
        }).start(() => setShineActive(true));
      });
    });
  }, [introOpacity, awarenessOpacity, awarenessScale, buttonOpacity]);

  const handleAwarenessTap = useCallback(() => {
    if (phase !== 'transition') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(awarenessOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('PhoneTimeQuiz');
    });
  }, [phase, awarenessOpacity, navigation]);

  return (
    <TouchableWithoutFeedback
      onPress={phase === 'intro' ? triggerTransition : handleAwarenessTap}
    >
      <View style={{ flex: 1 }}>
        <ScreenContainer>
          <Animated.View style={[styles.introWrap, { opacity: introOpacity }]}>
            <ProgressIndicator current={2} total={17} />

            <View style={styles.titleArea}>
              <Animated.Text style={[styles.title, { opacity: titlePart1Opacity }]}>
                You already know
              </Animated.Text>
              <Animated.Text style={[styles.title, { opacity: titlePart2Opacity }]}>
                what to do.
              </Animated.Text>
            </View>

            <View style={styles.centerArea}>
              <Animated.Text style={[styles.highlight, { opacity: middleOpacity }]}>
                But knowing hasn't been the problem.
              </Animated.Text>
            </View>
          </Animated.View>

          {phase === 'transition' && (
            <Animated.View
              style={[
                styles.awarenessWrap,
                {
                  opacity: awarenessOpacity,
                  transform: [{ scale: awarenessScale }],
                },
              ]}
            >
              <Text style={styles.awarenessText}>
                Awareness is the first discipline.
              </Text>

              <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
                <TouchableOpacity
                  onPress={handleAwarenessTap}
                  activeOpacity={0.85}
                >
                  <View style={styles.glassButton}>
                    <Text style={styles.continueButtonText}>Continue</Text>
                    <Animated.View
                      style={[
                        styles.shineOverlay,
                        {
                          transform: [
                            {
                              translateX: shineTranslate.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-120, 280],
                              }),
                            },
                          ],
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <LinearGradient
                        colors={[
                          'rgba(255,255,255,0)',
                          'rgba(255,255,255,0.28)',
                          'rgba(255,255,255,0)',
                        ]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.shineGradient}
                      />
                    </Animated.View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          )}
        </ScreenContainer>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  introWrap: {
    flex: 1,
  },
  titleArea: {
    marginTop: 12,
  },
  title: {
    ...Typography.hero,
    color: Colors.textPrimary,
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  highlight: {
    ...Typography.heading,
    color: Colors.primary,
    textAlign: 'center',
  },
  awarenessWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  awarenessText: {
    ...Typography.heading,
    color: Colors.accent,
    textAlign: 'center',
  },
  buttonWrap: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  glassButton: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 56,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  shineOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 100,
  },
  shineGradient: {
    flex: 1,
  },
  continueButtonText: {
    ...Typography.button,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
  },
});

export default SplashHookScreen;
