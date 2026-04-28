/**
 * SystemAnalysisScreen — onboarding step 13.
 * Terminal-style processing screen. Lines type in sequentially with
 * green checkmarks; auto-advances to StatReveal after the final line
 * lands. Builds anticipation before the stat reveal moment.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import HUDSectionLabel from '../components/HUDSectionLabel';
import TerminalLine from '../components/TerminalLine';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SystemAnalysis'>;

const GOAL_DISPLAY: Record<string, string> = {
  'Build a business or side project': 'business',
  'Advance my career': 'career',
  'Improve my physique': 'physique',
  'Increase discipline & self-control': 'discipline',
  'Reduce distractions': 'focus',
  'Improve emotional control': 'emotional control',
  'Study with consistency': 'study',
};

const SystemAnalysisScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('SystemAnalysis');

  const { state } = useOnboarding();
  const advancingRef = useRef(false);
  const [showFinal, setShowFinal] = useState(false);
  const screenOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  // Hard auto-advance ceiling (~5s) so we don't strand the user if
  // a TerminalLine completion callback is dropped on a slow device.
  useEffect(() => {
    const t = setTimeout(() => {
      if (advancingRef.current) return;
      advance();
    }, 5500);
    return () => clearTimeout(t);
  }, []);

  const advance = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => navigation.navigate('StatReveal'));
  };

  const goalText = state.primaryGoal
    ? (GOAL_DISPLAY[state.primaryGoal] ?? state.primaryGoal.toLowerCase())
    : 'discipline';

  const weaknessCount = state.selectedWeaknesses.length;
  const triggerCount = state.triggers.length;

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <HUDSectionLabel label="ANALYZING" />

          <View style={styles.terminal}>
            <TerminalLine
              text="> Processing answers..."
              delay={0}
              showCheck={false}
            />
            <TerminalLine
              text={`> Goal: ${goalText}`}
              delay={1000}
            />
            <TerminalLine
              text={`> Weakness scan: ${weaknessCount} flagged`}
              delay={1500}
            />
            <TerminalLine
              text={`> Trigger map: ${triggerCount > 0 ? 'loaded' : 'pending'}`}
              delay={2000}
            />
            <TerminalLine
              text={`> Morning pattern: ${state.morningRoutine ? 'flagged' : 'pending'}`}
              delay={2500}
            />
            <TerminalLine
              text="> Calibrating difficulty..."
              delay={3000}
            />
            <TerminalLine
              text="> Building mission set..."
              delay={3500}
            />
            <TerminalLine
              text="> SYSTEM READY"
              delay={4000}
              color={SystemTokens.cyan}
              onComplete={() => {
                setShowFinal(true);
                // Small beat after the final line lands, then advance.
                setTimeout(advance, 700);
              }}
            />

            {showFinal ? (
              <Text style={styles.readyTagline}>Initializing your character...</Text>
            ) : null}
          </View>
        </View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 48,
    justifyContent: 'flex-start',
  },
  terminal: {
    paddingTop: 8,
  },
  readyTagline: {
    marginTop: 18,
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: SystemTokens.textMuted,
  },
});

export default SystemAnalysisScreen;
