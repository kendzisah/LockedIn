import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { RankService } from '../../../services/RankService';

const STAT_ROWS: { label: string; color: string }[] = [
  { label: 'DISCIPLINE',  color: '#3A66FF' },
  { label: 'FOCUS',       color: '#00C2FF' },
  { label: 'EXECUTION',   color: '#00D68F' },
  { label: 'CONSISTENCY', color: '#FFC857' },
  { label: 'SOCIAL',      color: '#A855F7' },
];

const TYPING_TEXT = 'YOUR SYSTEM IS INITIALIZED';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StatReveal'>;

const StatRevealScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('StatReveal');
  const { state } = useOnboarding();

  const startingRank = RankService.rankFromStreak(0); // NPC
  const nextRank = RankService.nextRank(0);            // RECRUIT

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(20)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const ovrCount = useRef(new Animated.Value(0)).current;
  const [displayOvr, setDisplayOvr] = useState(0);
  const [typed, setTyped] = useState('');
  const advancingRef = useRef(false);

  // Stat bar fills (each animates from 0 to 1/99 width)
  const barProgress = useRef(STAT_ROWS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Typing animation for header (33ms per char ≈ 850ms total)
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTyped(TYPING_TEXT.slice(0, i));
      if (i >= TYPING_TEXT.length) clearInterval(interval);
    }, 35);

    // After 1s delay: card fades in
    const cardTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(cardTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();

      // OVR count up from 0 to 1
      Animated.timing(ovrCount, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();

      // Stat bars: 200ms staggered fill
      barProgress.forEach((bar, idx) => {
        Animated.timing(bar, {
          toValue: 1 / 99,
          duration: 600,
          delay: 800 + idx * 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }).start();
      });
    }, 1000);

    // Track displayed OVR via listener
    const ovrSub = ovrCount.addListener(({ value }) => {
      setDisplayOvr(Math.round(value));
    });

    // Button appears after 2s after all the staging
    const buttonTimer = setTimeout(() => {
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 1000 + 800 + STAT_ROWS.length * 200 + 500);

    return () => {
      clearInterval(interval);
      clearTimeout(cardTimer);
      clearTimeout(buttonTimer);
      ovrCount.removeListener(ovrSub);
    };
  }, [cardOpacity, cardTranslate, ovrCount, buttonOpacity, barProgress]);

  const handleBegin = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => navigation.navigate('Day90Preview'));
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
          <Text style={styles.typingHeader}>{typed}</Text>

          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardTranslate }],
              },
            ]}
          >
            {/* Inner glow */}
            <View style={styles.glowOrb} pointerEvents="none" />

            <Text style={styles.ovrLabel}>OVR</Text>
            <Text style={styles.ovrValue}>{displayOvr}</Text>
            <Text style={[styles.rankLabel, { color: startingRank.color }]}>
              ── {startingRank.name} ──
            </Text>

            <View style={styles.statBlock}>
              {STAT_ROWS.map((row, idx) => (
                <View key={row.label} style={styles.statRow}>
                  <Text style={styles.statLabel}>{row.label}</Text>
                  <View style={styles.statBarTrack}>
                    <Animated.View
                      style={[
                        styles.statBarFill,
                        {
                          backgroundColor: row.color,
                          width: barProgress[idx].interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.statValue}>1</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />
            <Text style={styles.buildHeader}>── YOUR BUILD ──</Text>
            <View style={styles.buildBlock}>
              <BuildLine label="Goal" value={state.primaryGoal ?? 'Build discipline'} />
              <BuildLine
                label="Weakness"
                value={state.selectedWeaknesses[0] ?? 'Inconsistency'}
              />
              <BuildLine label="Commitment" value={commitmentLabel} />
            </View>

            <View style={styles.divider} />
            <View style={styles.xpRow}>
              <Text style={styles.xpText}>XP: 0</Text>
              <Text style={styles.xpText}>
                Next rank:{' '}
                <Text style={{ color: nextRank?.color ?? Colors.textPrimary }}>
                  {nextRank?.name ?? 'MAX'}
                </Text>{' '}
                <Text style={styles.xpMuted}>
                  (Day {nextRank?.minDays ?? 0})
                </Text>
              </Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.footer, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            style={styles.cta}
            onPress={handleBegin}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Begin my evolution</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScreenContainer>
    </Animated.View>
  );
};

const BuildLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.buildRow}>
    <Text style={styles.buildLabel}>{label}:</Text>
    <Text style={styles.buildValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 24,
    alignItems: 'center',
  },
  typingHeader: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    letterSpacing: -0.2,
    color: Colors.accent,
    minHeight: 28,
    marginBottom: 16,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(21,26,33,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 20,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(58,102,255,0.06)',
  },
  ovrLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    letterSpacing: 1.5,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  ovrValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 64,
    lineHeight: 72,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 4,
  },
  rankLabel: {
    fontFamily: FontFamily.heading,
    fontSize: 16,
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 4,
  },
  statBlock: {
    marginTop: 20,
    gap: 10,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statLabel: {
    width: 96,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: Colors.textSecondary,
  },
  statBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statValue: {
    width: 24,
    textAlign: 'right',
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  divider: {
    marginTop: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  buildHeader: {
    marginTop: 16,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  buildBlock: {
    marginTop: 12,
    gap: 6,
  },
  buildRow: {
    flexDirection: 'row',
    gap: 8,
  },
  buildLabel: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    width: 96,
  },
  buildValue: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  xpRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  xpMuted: {
    color: Colors.textMuted,
    fontFamily: FontFamily.body,
  },
  footer: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  cta: {
    backgroundColor: 'rgba(58,102,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(120,160,255,0.55)',
    borderRadius: 28,
    paddingVertical: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A66FF',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: -0.1,
    color: Colors.textPrimary,
  },
});

export default StatRevealScreen;
