import React, { useEffect, useRef } from 'react';
import {
  Animated,
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
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 25;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'HabitFormation'>;

const HabitFormationScreen: React.FC<Props> = ({ navigation }) => {
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;

  const subheadOpacity = useRef(new Animated.Value(0)).current;
  const subheadTranslateY = useRef(new Animated.Value(SLIDE)).current;

  const patternOpacity = useRef(new Animated.Value(0)).current;
  const patternTranslateY = useRef(new Animated.Value(SLIDE)).current;

  const habitsOpacity = useRef(new Animated.Value(0)).current;
  const habitsTranslateY = useRef(new Animated.Value(SLIDE)).current;

  const closingOpacity = useRef(new Animated.Value(0)).current;

  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(subheadOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(subheadTranslateY, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }, 900),
    );

    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(patternOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(patternTranslateY, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1800),
    );

    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(habitsOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(habitsTranslateY, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }, 2800),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(closingOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      }, 4000),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 5000),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    titleOpacity,
    titleTranslateY,
    subheadOpacity,
    subheadTranslateY,
    patternOpacity,
    patternTranslateY,
    habitsOpacity,
    habitsTranslateY,
    closingOpacity,
    buttonOpacity,
  ]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer>
        <ProgressIndicator current={5} total={13} />

        <View style={styles.body}>
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            History's top performers didn't drift into success.
          </Animated.Text>

          <Animated.Text
            style={[
              styles.subhead,
              {
                opacity: subheadOpacity,
                transform: [{ translateY: subheadTranslateY }],
              },
            ]}
          >
            They built controlled mornings.
          </Animated.Text>

          <Animated.View
            style={{
              opacity: patternOpacity,
              transform: [{ translateY: patternTranslateY }],
            }}
          >
            <Text style={styles.bodyText}>
              From CEOs to elite athletes,{'\n'}the pattern is consistent:
            </Text>
          </Animated.View>

          <Animated.View
            style={{
              opacity: habitsOpacity,
              transform: [{ translateY: habitsTranslateY }],
            }}
          >
            <Text style={styles.bodyText}>
              They wake up with intention.{'\n'}They decide their focus early.
              {'\n'}They protect their mental state{'\n'}before the world makes
              demands.
            </Text>
          </Animated.View>

          <Animated.View style={{ opacity: closingOpacity }}>
            <Text style={styles.closing}>
              A strong morning compounds into a strong day.{'\n'}A strong day
              compounds into a strong life.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Animated.timing(screenOpacity, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }).start(() => {
                navigation.navigate('DisciplineVision');
              });
            }}
            activeOpacity={0.7}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Continue →</Text>
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
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 32,
    color: Colors.primary,
    marginBottom: 16,
  },
  subhead: {
    fontFamily: FontFamily.headingBold,
    fontSize: 20,
    letterSpacing: -0.3,
    lineHeight: 26,
    color: Colors.primary,
    marginBottom: 22,
  },
  bodyText: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  closing: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
    opacity: 0.8,
    marginTop: 4,
  },
  buttonWrap: {
    paddingBottom: 32,
    alignItems: 'flex-end',
  },
  ctaButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  ctaText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 17,
    color: Colors.textSecondary,
  },
});

export default HabitFormationScreen;
