/**
 * DailyTimeCommitmentScreen — onboarding step 10: "Your Daily Commitment."
 * Single-select daily focus minutes. Drives session length defaults +
 * onboarding analytics segmentation.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import HUDSectionLabel from '../components/HUDSectionLabel';
import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'DailyTimeCommitment'>;

interface Option {
  /** Persisted daily-minute total. */
  minutes: number;
  /** Big label rendered on the card. */
  primary: string;
  /** Small unit label below (e.g. "min"). */
  unit: string;
}

const OPTIONS: Option[] = [
  { minutes: 15,  primary: '15',  unit: 'min' },
  { minutes: 30,  primary: '30',  unit: 'min' },
  { minutes: 45,  primary: '45',  unit: 'min' },
  { minutes: 60,  primary: '1',   unit: 'h'   },
  { minutes: 90,  primary: '1.5', unit: 'h'   },
  { minutes: 120, primary: '2',   unit: 'h'   },
];

const DailyTimeCommitmentScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('DailyTimeCommitment');

  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<number | null>(null);
  const advancingRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const handleSelect = (opt: Option) => {
    if (advancingRef.current) return;
    setSelected(opt.minutes);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_DAILY_MINUTES', payload: opt.minutes });
    Analytics.track('Onboarding Answer Submitted', {
      screen: 'DailyTimeCommitment',
      answer: `${opt.minutes} min`,
      daily_minutes: opt.minutes,
    });

    advancingRef.current = true;
    setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => navigation.navigate('WhyNow'));
    }, 500);
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <HUDSectionLabel label="SESSION PROTOCOL" />
          <Text style={styles.title}>
            How many minutes will you lock in each day?
          </Text>
          <Text style={styles.subtitle}>
            Start where you can be consistent. The system adapts.
          </Text>

          <View style={styles.grid}>
            {OPTIONS.map((opt) => {
              const isSelected = selected === opt.minutes;
              return (
                <TouchableOpacity
                  key={opt.minutes}
                  style={[styles.card, isSelected && styles.cardSelected]}
                  onPress={() => handleSelect(opt)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.cardPrimary, isSelected && styles.cardPrimarySelected]}>
                    {opt.primary}
                  </Text>
                  <Text style={[styles.cardUnit, isSelected && styles.cardUnitSelected]}>
                    {opt.unit}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.hint}>Most users start with 30 minutes.</Text>
        </View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 32,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: SystemTokens.panelBg,
    borderWidth: 1,
    borderColor: SystemTokens.panelBorder,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cardSelected: {
    backgroundColor: 'rgba(58,102,255,0.14)',
    borderColor: SystemTokens.glowAccent,
    borderLeftColor: SystemTokens.glowAccent,
  },
  cardPrimary: {
    fontFamily: FontFamily.headingBold,
    fontSize: 30,
    letterSpacing: -1,
    color: Colors.textPrimary,
  },
  cardPrimarySelected: {
    color: SystemTokens.glowAccent,
    textShadowColor: SystemTokens.glowAccent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  cardUnit: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: SystemTokens.textMuted,
  },
  cardUnitSelected: {
    color: SystemTokens.glowAccent,
  },
  hint: {
    marginTop: 20,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: SystemTokens.textMuted,
    textAlign: 'center',
  },
});

export default DailyTimeCommitmentScreen;
