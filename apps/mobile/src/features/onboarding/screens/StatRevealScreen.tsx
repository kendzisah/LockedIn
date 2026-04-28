/**
 * StatRevealScreen — onboarding step 14: "Your Starting Stats."
 *
 * The character-creation moment. Shows OVR=1, all five stats=1, and the
 * user's build summary inside an HUD panel with sectioned `// STATUS`,
 * `// STATS`, `// BUILD` blocks. Button is gated behind a 2s absorption
 * delay per spec.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import PrimaryButton from '../../../design/components/PrimaryButton';
import HUDPanel from '../../home/components/HUDPanel';
import CountUpNumber from '../components/CountUpNumber';
import TypingText from '../components/TypingText';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SectionLabelStyle, SystemTokens } from '../../home/systemTokens';
import { RankService } from '../../../services/RankService';

const STAT_ROWS: { abbr: string; label: string; color: string }[] = [
  { abbr: 'DIS', label: 'Discipline',  color: '#3A66FF' },
  { abbr: 'FOC', label: 'Focus',       color: '#0BC2F7' },
  { abbr: 'EXE', label: 'Execution',   color: '#00D65F' },
  { abbr: 'CON', label: 'Consistency', color: '#FFCB57' },
  { abbr: 'SOC', label: 'Social',      color: '#AB55F7' },
];

const STARTING_STAT = 1;
const MAX_STAT = 99;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StatReveal'>;

const StatRevealScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('StatReveal');
  const { state } = useOnboarding();

  const startingRank = RankService.rankFromStreak(0);
  const nextRank = RankService.nextRank(0);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslate = useRef(new Animated.Value(20)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const advancingRef = useRef(false);

  const barFills = useRef(STAT_ROWS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Panel reveals 1s after the typed header lands, then stat bars stagger
    // (100ms each per spec), then CTA appears after a 2s absorption beat.
    const panelTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(panelOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(panelTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();

      barFills.forEach((bar, idx) => {
        Animated.timing(bar, {
          toValue: STARTING_STAT / MAX_STAT,
          duration: 500,
          delay: 400 + idx * 100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }).start();
      });
    }, 1000);

    const ctaDelayMs = 1000 + 400 + STAT_ROWS.length * 100 + 500 + 2000;
    const ctaTimer = setTimeout(() => {
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, ctaDelayMs);

    return () => {
      clearTimeout(panelTimer);
      clearTimeout(ctaTimer);
    };
  }, [panelOpacity, panelTranslate, buttonOpacity, barFills]);

  const handleBegin = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => navigation.navigate('BenefitExecution'));
  };

  const dailyMinutes = state.dailyMinutes ?? 30;
  const commitmentLabel =
    dailyMinutes >= 60
      ? `${(dailyMinutes / 60).toString().replace(/\.0$/, '')} h/day`
      : `${dailyMinutes} min/day`;

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <TypingText
            text="// SYSTEM INITIALIZED"
            charDelay={28}
            style={styles.bootHeader}
          />
          <LinearGradient
            colors={[SystemTokens.cyan, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bootRule}
          />

          <Animated.View
            style={{
              opacity: panelOpacity,
              transform: [{ translateY: panelTranslate }],
              marginTop: 16,
            }}
          >
            <HUDPanel headerLabel="STATUS" style={styles.panel}>
              <View style={styles.statusRow}>
                <View style={styles.ovrBox}>
                  <Text style={styles.ovrLabel}>OVR</Text>
                  <CountUpNumber
                    value={1}
                    duration={900}
                    startDelay={200}
                    style={styles.ovrValue}
                  />
                </View>
                <View style={styles.statusMeta}>
                  <Text style={[styles.rankName, { color: startingRank.color }]}>
                    {startingRank.name.toUpperCase()}
                  </Text>
                  <Text style={styles.metaSub}>Day 0</Text>
                </View>
              </View>
            </HUDPanel>

            <HUDPanel headerLabel="STATS" style={styles.panel}>
              {STAT_ROWS.map((row, idx) => (
                <View key={row.abbr} style={styles.statRow}>
                  <Text style={styles.statAbbr}>{row.abbr}</Text>
                  <View style={styles.statBarTrack}>
                    <Animated.View
                      style={[
                        styles.statBarFill,
                        {
                          backgroundColor: row.color,
                          width: barFills[idx].interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.statBarTip,
                        {
                          backgroundColor: row.color,
                          left: barFills[idx].interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.statValue}>{STARTING_STAT}</Text>
                </View>
              ))}
            </HUDPanel>

            <HUDPanel headerLabel="BUILD" style={styles.panel}>
              <BuildLine label="Goal" value={state.primaryGoal ?? 'Build discipline'} />
              <BuildLine
                label="Weakness"
                value={
                  state.selectedWeaknesses.length > 0
                    ? state.selectedWeaknesses.join(' · ')
                    : 'Inconsistency'
                }
              />
              <BuildLine label="Commitment" value={commitmentLabel} />
              <View style={styles.buildDivider} />
              <View style={styles.xpRow}>
                <Text style={styles.xpText}>XP: 0</Text>
                <Text style={styles.xpText}>
                  Next rank{' '}
                  <Text style={{ color: nextRank?.color ?? Colors.textPrimary }}>
                    {(nextRank?.name ?? 'MAX').toUpperCase()}
                  </Text>
                  <Text style={styles.xpMuted}>
                    {' '}(Day {nextRank?.minDays ?? 0})
                  </Text>
                </Text>
              </View>
            </HUDPanel>
          </Animated.View>
        </View>

        <Animated.View style={[styles.footer, { opacity: buttonOpacity }]}>
          <PrimaryButton
            title="> BEGIN MY EVOLUTION"
            onPress={handleBegin}
            style={styles.cta}
          />
        </Animated.View>
      </ScreenContainer>
    </Animated.View>
  );
};

const BuildLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.buildRow}>
    <Text style={styles.buildLabel}>{label}</Text>
    <Text style={styles.buildValue} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 16,
  },
  bootHeader: {
    ...SectionLabelStyle,
    color: SystemTokens.cyan,
    textShadowColor: SystemTokens.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  bootRule: {
    height: 1,
    marginTop: 6,
  },
  panel: {
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ovrBox: {
    width: 96,
    height: 96,
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(58,102,255,0.04)',
  },
  ovrLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: SystemTokens.textMuted,
  },
  ovrValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1,
    color: Colors.textPrimary,
    textShadowColor: SystemTokens.glowAccent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  statusMeta: {
    flex: 1,
  },
  rankName: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    letterSpacing: 0.6,
  },
  metaSub: {
    marginTop: 4,
    fontFamily: FontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: SystemTokens.textMuted,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  statAbbr: {
    width: 32,
    fontFamily: FontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: SystemTokens.textSecondary,
  },
  statBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
  },
  statBarTip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    transform: [{ translateX: -2 }],
    opacity: 0.85,
  },
  statValue: {
    width: 24,
    textAlign: 'right',
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  buildRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    gap: 12,
  },
  buildLabel: {
    width: 96,
    fontFamily: FontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: SystemTokens.textMuted,
    paddingTop: 2,
  },
  buildValue: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textPrimary,
  },
  buildDivider: {
    marginTop: 8,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  xpText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  xpMuted: {
    color: SystemTokens.textMuted,
    fontFamily: FontFamily.body,
  },
  footer: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  cta: {
    width: '100%',
  },
});

export default StatRevealScreen;
