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
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const LIFE_EXPECTANCY = 80;
const DEFAULT_AGE = 25;

function parseHoursPerDay(phoneLabel: string): number {
  const match = phoneLabel.match(/^(\d+)\s*hours?$/i);
  if (match) return parseInt(match[1], 10);
  if (phoneLabel === 'unknown') return 4;
  return 3;
}

function calcYearsLost(phoneLabel: string, age: number | null): number {
  const hoursPerDay = parseHoursPerDay(phoneLabel);
  const currentAge = age ?? DEFAULT_AGE;
  const yearsRemaining = LIFE_EXPECTANCY - currentAge;
  return Math.round(yearsRemaining * (hoursPerDay / 16));
}

const COUNT_DURATION = 800;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'LossAversionStat'>;

const LossAversionStatScreen: React.FC<Props> = ({ navigation }) => {
  const { state } = useOnboarding();
  const yearsLost = calcYearsLost(state.phoneUsageHours ?? '', state.userAge);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayNum, setDisplayNum] = React.useState(0);
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listenerId = countAnim.addListener(({ value }) => {
      setDisplayNum(Math.round(value));
    });

    Animated.timing(countAnim, {
      toValue: yearsLost,
      duration: COUNT_DURATION,
      useNativeDriver: false,
    }).start(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    });

    const t1 = setTimeout(() => {
      Animated.timing(subtextOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, COUNT_DURATION + 400);

    const t2 = setTimeout(() => {
      Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, COUNT_DURATION + 1200);

    return () => {
      countAnim.removeListener(listenerId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [countAnim, yearsLost, subtextOpacity, buttonOpacity]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer>
        <ProgressIndicator current={5} total={19} />

        <View style={styles.body}>
          <Text style={styles.statNumber}>
            {displayNum} years
          </Text>
          <Animated.View style={{ opacity: subtextOpacity, marginTop: 24 }}>
            <Text style={styles.subtext}>
              Looking down at your phone. {displayNum} years of potential lost to distraction.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
                navigation.navigate('TopPerformersFrame');
              });
            }}
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
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  statNumber: {
    fontFamily: FontFamily.headingBold,
    fontSize: 48,
    letterSpacing: -1,
    lineHeight: 56,
    color: Colors.primary,
  },
  statLabel: {
    fontFamily: FontFamily.body,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  subtext: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  buttonWrap: { paddingBottom: 32, alignItems: 'flex-end' },
  continueButton: { paddingVertical: 12, paddingHorizontal: 8 },
  continueText: { fontFamily: FontFamily.bodyMedium, color: Colors.textSecondary, fontSize: 17 },
});

export default LossAversionStatScreen;
