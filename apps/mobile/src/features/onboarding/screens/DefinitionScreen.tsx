/**
 * DefinitionScreen — onboarding step 1: "System Boot".
 *
 * Replaces the prior dictionary-definition variant with the HUD system-boot
 * sequence: typed `> SYSTEM INITIALIZING`, then staggered fade-in lines,
 * then the `> INITIALIZE SYSTEM` action. The sign-in escape hatch is kept
 * so existing users can still bypass onboarding.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import type { OnboardingStackParamList } from '../../../types/navigation';
import ScreenContainer from '../../../design/components/ScreenContainer';
import PrimaryButton from '../../../design/components/PrimaryButton';
import TypingText from '../components/TypingText';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Definition'>;

const DefinitionScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('Definition');

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const line1Opacity = useRef(new Animated.Value(0)).current;
  const line2Opacity = useRef(new Animated.Value(0)).current;
  const line3Opacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  const [bootDone, setBootDone] = useState(false);
  const advancingRef = useRef(false);

  // Sequence kicks off after the boot-text typing completes.
  const handleBootDone = () => {
    if (bootDone) return;
    setBootDone(true);

    Animated.sequence([
      Animated.delay(800),
      Animated.timing(line1Opacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.delay(700),
      Animated.timing(line2Opacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(line3Opacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.delay(700),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleStart = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => navigation.navigate('PhoneTimeQuiz'));
  };

  const handleSignIn = () => {
    Haptics.selectionAsync();
    navigation.navigate('OnboardingAuth', { mode: 'signin' });
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
        <ScreenContainer>
          <View style={styles.content}>
            <TypingText
              text="> SYSTEM INITIALIZING..."
              charDelay={40}
              startDelay={300}
              onComplete={handleBootDone}
              style={styles.bootLine}
            />

            <Animated.Text style={[styles.line, { opacity: line1Opacity }]}>
              Most people know what to do.
            </Animated.Text>

            <Animated.Text style={[styles.line, { opacity: line2Opacity }]}>
              They just don't do it.
            </Animated.Text>

            <Animated.Text style={[styles.lineEmphasis, { opacity: line3Opacity }]}>
              You're here because you're different.
            </Animated.Text>

            <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
              <PrimaryButton
                title="> INITIALIZE SYSTEM"
                onPress={handleStart}
                style={styles.cta}
              />
            </Animated.View>
          </View>
        </ScreenContainer>
      </Animated.View>

      {/* Sign-in escape hatch — absolutely positioned outside the screen
          fade so existing users can bypass the System Boot. */}
      <SafeAreaView style={styles.signInBar} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity
          onPress={handleSignIn}
          style={styles.signInBtn}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Text style={styles.signInText}>Sign in</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  bootLine: {
    fontFamily: FontFamily.mono,
    fontSize: 14,
    letterSpacing: 1,
    color: SystemTokens.glowAccent,
    marginBottom: 36,
  },
  line: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 22,
    lineHeight: 30,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  lineEmphasis: {
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
    lineHeight: 32,
    color: SystemTokens.cyan,
    marginTop: 26,
    textShadowColor: SystemTokens.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  buttonWrap: {
    marginTop: 48,
  },
  cta: {
    width: '100%',
  },
  signInBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  signInBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  signInText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 0.2,
  },
});

export default DefinitionScreen;
