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
import { MixpanelService } from '../../../services/MixpanelService';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

function computeStat(dailyMinutes: number | null): { hours: string; numericTarget: number } {
  const mins = dailyMinutes ?? 60;
  const totalHours = Math.round((mins * 90) / 60);
  return { hours: `${totalHours}+ hours in 90 days`, numericTarget: totalHours };
}

const COUNT_DURATION = 800;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CompoundStat'>;

const CompoundStatScreen: React.FC<Props> = ({ navigation }) => {
  const { state } = useOnboarding();
  const stat = computeStat(state.dailyMinutes);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayNum, setDisplayNum] = React.useState(0);
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    MixpanelService.track('Onboarding Screen Viewed', { screen: 'CompoundStat', step: 11, total_steps: 17 });
  }, []);

  useEffect(() => {
    const listenerId = countAnim.addListener(({ value }) => {
      setDisplayNum(Math.round(value * 10) / 10);
    });

    Animated.timing(countAnim, {
      toValue: stat.numericTarget,
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
  }, [countAnim, stat.numericTarget, subtextOpacity, buttonOpacity]);

  const displaySuffix = stat.numericTarget >= 22 ? '+' : '';

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer>
        <ProgressIndicator current={10} total={17} />

        <View style={styles.body}>
          <Text style={styles.statNumber}>
            {displayNum}{displaySuffix} hours
          </Text>
          <Text style={styles.statLabel}>in 90 days</Text>

          <Animated.View style={{ opacity: subtextOpacity, marginTop: 24 }}>
            <Text style={styles.subtext}>
              Over {stat.numericTarget}{displaySuffix} hours invested in your future self.
            </Text>
            <Text style={styles.anchor}>
              Repetition builds control.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
                navigation.navigate('NinetyDayVision');
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
  anchor: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
    opacity: 0.8,
  },
  buttonWrap: { paddingBottom: 32, alignItems: 'flex-end' },
  continueButton: { paddingVertical: 12, paddingHorizontal: 8 },
  continueText: { fontFamily: FontFamily.bodyMedium, color: Colors.textSecondary, fontSize: 17 },
});

export default CompoundStatScreen;
