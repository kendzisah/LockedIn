import React, { useCallback, useEffect, useRef } from 'react';
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
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 25;

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'QuickLockInComplete'
>;

const QuickLockInCompleteScreen: React.FC<Props> = ({ navigation }) => {
  // ── Screen-level fade ──
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // ── Content stagger ──
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const bodyTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const repeatOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 0ms — Headline
    Animated.parallel([
      Animated.timing(headlineOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(headlineTranslateY, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // 1000ms — Body line
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

    // 2000ms — "Repeat this daily."
    timers.push(
      setTimeout(() => {
        Animated.timing(repeatOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 2000),
    );

    // 3000ms — CTA
    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 3000),
    );

    // 3500ms — Request App Store review
    timers.push(
      setTimeout(async () => {
        if (await StoreReview.hasAction()) {
          StoreReview.requestReview();
        }
      }, 3500),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    headlineOpacity,
    headlineTranslateY,
    bodyOpacity,
    bodyTranslateY,
    repeatOpacity,
    buttonOpacity,
  ]);

  const handleUnlock = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('IdentityReinforcement');
    });
  }, [screenOpacity, navigation]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
    <ScreenContainer>
      <ProgressIndicator current={12} total={13} />

      <View style={styles.body}>
        {/* Headline — verdict, not explanation */}
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: headlineOpacity,
              transform: [{ translateY: headlineTranslateY }],
            },
          ]}
        >
          That's control.
        </Animated.Text>

        {/* Body — identity reinforcement */}
        <Animated.Text
          style={[
            styles.bodyLine,
            {
              opacity: bodyOpacity,
              transform: [{ translateY: bodyTranslateY }],
            },
          ]}
        >
          You just chose <Text style={styles.emphasis}>discipline</Text> over
          impulse.
        </Animated.Text>

        {/* Repeat — sharp, authoritative */}
        <Animated.Text style={[styles.repeat, { opacity: repeatOpacity }]}>
          Repeat this daily.
        </Animated.Text>
      </View>

      <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
        <TouchableOpacity
          onPress={handleUnlock}
          activeOpacity={0.7}
          style={styles.continueButton}
        >
          <Text style={styles.continueText}>Continue →</Text>
        </TouchableOpacity>
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
    fontSize: 36,
    letterSpacing: -0.8,
    lineHeight: 42,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  // ── Body — white with one blue keyword ──
  bodyLine: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  emphasis: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
  },
  // ── Repeat — subtle authority ──
  repeat: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  buttonWrap: {
    paddingBottom: 32,
    alignItems: 'flex-end',
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  continueText: {
    fontFamily: FontFamily.bodyMedium,
    color: Colors.textSecondary,
    fontSize: 17,
  },
});

export default QuickLockInCompleteScreen;
