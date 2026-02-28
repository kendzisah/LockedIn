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
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 25;

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'IdentityReinforcement'
>;

const IdentityReinforcementScreen: React.FC<Props> = ({ navigation }) => {
  // ── Screen-level fade ──
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // ── Staggered content ──
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const bodyTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 0ms — Title
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // 1000ms — Body
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

    // 2200ms — Button
    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 2200),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    titleOpacity,
    titleTranslateY,
    bodyOpacity,
    bodyTranslateY,
    buttonOpacity,
  ]);

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('SignatureCommitment');
    });
  }, [screenOpacity, navigation]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
    <ScreenContainer>
      <View style={styles.body}>
        {/* Title */}
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          Discipline is repetition.
        </Animated.Text>

        {/* Body */}
        <Animated.View
          style={{
            opacity: bodyOpacity,
            transform: [{ translateY: bodyTranslateY }],
          }}
        >
          <Text style={styles.bodyLine}>One session doesn't change you.</Text>
          <Text style={styles.bodyEmphasis}>Daily sessions do.</Text>
          <Text style={[styles.bodyLine, { marginTop: 20 }]}>
            You've started.
          </Text>
          <Text style={styles.bodyEmphasis}>Now commit.</Text>
        </Animated.View>
      </View>

      {/* CTA */}
      <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.9}
          style={styles.ctaButton}
        >
          <Text style={styles.ctaText}>Unlock Full Lock In System</Text>
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
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    letterSpacing: -0.7,
    lineHeight: 38,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  bodyLine: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 24,
    color: Colors.textSecondary,
  },
  bodyEmphasis: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 24,
    color: Colors.textPrimary,
    marginTop: 2,
  },
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

export default IdentityReinforcementScreen;
