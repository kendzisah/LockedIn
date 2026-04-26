/**
 * Day90PreviewScreen — Step 11.
 *
 * Sits between StatReveal (your current OVR 1 / NPC) and VulnerableTime.
 * Shows the user a projected character card at Day 90, anchored to the
 * LEGEND rank — same visual language as StatReveal so the user reads it
 * as "this is the same character, 90 days later."
 *
 * Numbers are aspirational projections, not derived from formula. They
 * represent what a *consistent* 90 days inside the system unlocks.
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
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { RANK_BY_ID } from '../../../design/rankTiers';

interface ProjectedStat {
  label: string;
  start: number;
  end: number;
  color: string;
}

const STATS: ProjectedStat[] = [
  { label: 'DISCIPLINE',  start: 1, end: 71, color: '#3A66FF' },
  { label: 'FOCUS',       start: 1, end: 65, color: '#00C2FF' },
  { label: 'EXECUTION',   start: 1, end: 68, color: '#00D68F' },
  { label: 'CONSISTENCY', start: 1, end: 72, color: '#FFC857' },
  { label: 'SOCIAL',      start: 1, end: 58, color: '#A855F7' },
];

const TARGET_OVR = 67;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Day90Preview'>;

const Day90PreviewScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('Day90Preview');
  const { state } = useOnboarding();

  const futureRank = RANK_BY_ID.legend;

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(14)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(20)).current;
  const ovrCount = useRef(new Animated.Value(0)).current;
  const [displayOvr, setDisplayOvr] = useState(0);
  const statBars = useRef(STATS.map(() => new Animated.Value(0))).current;
  const statValues = useRef(STATS.map(() => new Animated.Value(0))).current;
  const [statDisplay, setStatDisplay] = useState<number[]>(STATS.map(() => 0));
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const advancingRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(cardOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(cardTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();

        Animated.timing(ovrCount, {
          toValue: TARGET_OVR,
          duration: 1400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }, 600),
    );

    // Stagger stat bars
    STATS.forEach((stat, idx) => {
      timers.push(
        setTimeout(() => {
          Animated.timing(statBars[idx], {
            toValue: stat.end / 99,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
          Animated.timing(statValues[idx], {
            toValue: stat.end,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
        }, 1200 + idx * 200),
      );
    });

    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 1200 + STATS.length * 200 + 600),
    );

    const ovrSub = ovrCount.addListener(({ value }) => {
      setDisplayOvr(Math.round(value));
    });
    const statSubs = statValues.map((v, idx) =>
      v.addListener(({ value }) => {
        setStatDisplay((prev) => {
          if (Math.round(value) === prev[idx]) return prev;
          const next = [...prev];
          next[idx] = Math.round(value);
          return next;
        });
      }),
    );

    return () => {
      timers.forEach(clearTimeout);
      ovrCount.removeListener(ovrSub);
      statValues.forEach((v, idx) => v.removeListener(statSubs[idx]));
    };
  }, [
    headerOpacity,
    headerTranslate,
    cardOpacity,
    cardTranslate,
    ovrCount,
    statBars,
    statValues,
    buttonOpacity,
  ]);

  const handleContinue = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => navigation.navigate('VulnerableTime'));
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
          <Animated.View
            style={{
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslate }],
            }}
          >
            <Text style={styles.eyebrow}>DAY 90</Text>
            <Text style={styles.title}>This is who{'\n'}you'll be.</Text>
            <Text style={styles.subtitle}>
              Show up at {commitmentLabel} and this is what the system builds.
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardTranslate }],
              },
            ]}
          >
            <View style={styles.glowOrb} pointerEvents="none" />

            <View style={styles.headerRow}>
              <View>
                <Text style={styles.ovrLabel}>OVR</Text>
                <Text style={styles.ovrValue}>{displayOvr}</Text>
              </View>
              <View style={styles.rankBadgeWrap}>
                <View
                  style={[
                    styles.rankBadge,
                    {
                      borderColor: futureRank.color,
                      backgroundColor: `${futureRank.color}1A`,
                      shadowColor: futureRank.color,
                    },
                  ]}
                >
                  <Text style={[styles.rankBadgeText, { color: futureRank.color }]}>
                    {futureRank.name}
                  </Text>
                </View>
                <Text style={styles.streakHint}>90-day streak</Text>
              </View>
            </View>

            <View style={styles.statBlock}>
              {STATS.map((stat, idx) => (
                <View key={stat.label} style={styles.statRow}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <View style={styles.statBarTrack}>
                    <Animated.View
                      style={[
                        styles.statBarFill,
                        {
                          backgroundColor: stat.color,
                          width: statBars[idx].interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.statValueText}>{statDisplay[idx]}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.footer, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            style={styles.cta}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Show me how to get there</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 8,
  },
  eyebrow: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    letterSpacing: 1.6,
    color: Colors.warning,
  },
  title: {
    marginTop: 6,
    fontFamily: FontFamily.headingBold,
    fontSize: 30,
    letterSpacing: -0.4,
    lineHeight: 34,
    color: Colors.textPrimary,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  card: {
    marginTop: 24,
    backgroundColor: 'rgba(21,26,33,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
    borderRadius: 18,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  glowOrb: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(168,85,247,0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ovrLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: Colors.textSecondary,
  },
  ovrValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 56,
    lineHeight: 60,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  rankBadgeWrap: {
    alignItems: 'flex-end',
  },
  rankBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  rankBadgeText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 14,
    letterSpacing: 1.4,
  },
  streakHint: {
    marginTop: 6,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
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
  statValueText: {
    width: 28,
    textAlign: 'right',
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
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

export default Day90PreviewScreen;
