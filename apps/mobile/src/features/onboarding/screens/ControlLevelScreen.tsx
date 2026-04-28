/**
 * ControlLevelScreen — onboarding step 12: "Your Control Level."
 * Single-select self-assessment that sets the starting difficulty tier
 * for the mission engine.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import type { ControlLevel } from '../state/types';
import ScreenContainer from '../../../design/components/ScreenContainer';
import HUDOptionCard from '../components/HUDOptionCard';
import HUDSectionLabel from '../components/HUDSectionLabel';
import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ControlLevel'>;

const ICON_SIZE = 18;

interface Option {
  value: ControlLevel;
  label: string;
  icon: React.ReactNode;
}

const OPTIONS: Option[] = [
  {
    value: 'almost_none',
    label: 'Almost none — I react to everything',
    icon: <Ionicons name="alert-circle" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'some',
    label: 'Some — but I slip often',
    icon: <Ionicons name="remove-circle" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'decent',
    label: 'Decent — I just need structure',
    icon: <Ionicons name="checkmark-circle" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
  {
    value: 'strong',
    label: 'Strong — I need the next level',
    icon: <Ionicons name="arrow-up-circle" size={ICON_SIZE} color={SystemTokens.glowAccent} />,
  },
];

const ControlLevelScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('ControlLevel');
  const { dispatch } = useOnboarding();

  const [selected, setSelected] = useState<ControlLevel | null>(null);
  const advancingRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const handleSelect = (value: ControlLevel) => {
    if (advancingRef.current) return;
    setSelected(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_CONTROL_LEVEL', payload: value });
    Analytics.track('Onboarding Answer Submitted', {
      screen: 'ControlLevel',
      answer: value,
    });

    advancingRef.current = true;
    setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => navigation.navigate('SystemAnalysis'));
    }, 500);
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <HUDSectionLabel label="BASELINE ASSESSMENT" />
          <Text style={styles.title}>
            How much control do you have over your daily habits?
          </Text>
          <Text style={styles.subtitle}>This sets your starting difficulty.</Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => (
              <HUDOptionCard
                key={opt.value}
                label={opt.label}
                leading={opt.icon}
                selected={selected === opt.value}
                onPress={() => handleSelect(opt.value)}
              />
            ))}
          </View>
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
  options: {
    gap: 8,
  },
});

export default ControlLevelScreen;
