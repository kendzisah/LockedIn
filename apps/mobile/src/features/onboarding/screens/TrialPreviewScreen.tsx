/**
 * TrialPreviewScreen — Step 22.
 *
 * Sits between SocialProof and Paywall. Shows the user a concrete
 * preview of what 3 days inside the system delivers:
 *   - the rank climb (NPC → RECRUIT on Day 3)
 *   - hours reclaimed (their phone usage * 0.8 * 3 days)
 *   - reassurance that we'll notify before the trial ends
 *
 * The "3 days" framing matches the RevenueCat yearly trial length so the
 * implicit promise matches what the paywall delivers.
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
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { RANK_BY_ID } from '../../../design/rankTiers';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RECLAIM_PCT = 0.8;
const TRIAL_DAYS = 3;

function parseHoursPerDay(phoneLabel: string): number {
  const match = phoneLabel.match(/^(\d+)\s*hours?$/i);
  if (match) return parseInt(match[1], 10);
  if (phoneLabel === 'unknown') return 4;
  return 4;
}

interface DayNode {
  day: number;
  rankId: 'npc' | 'grinder';
  ovr: number;
}

const TIMELINE: DayNode[] = [
  { day: 0, rankId: 'npc',     ovr: 1 },
  { day: 1, rankId: 'npc',     ovr: 4 },
  { day: 2, rankId: 'npc',     ovr: 7 },
  { day: 3, rankId: 'grinder', ovr: 12 },
];

// ─── Chart component ─────────────────────────────────────

const CHART_HEIGHT = 200;
const CHART_PADDING_X = 24;
const CHART_PADDING_TOP = 24;
const CHART_PADDING_BOTTOM = 56; // room for X-axis labels
const DOT_RADIUS_DEFAULT = 5;
const DOT_RADIUS_LAST = 8;

interface ChartProps {
  chartProgress: Animated.Value;
  dotOpacities: Animated.Value[];
}

const ProgressionChart: React.FC<ChartProps> = ({ chartProgress, dotOpacities }) => {
  const [width, setWidth] = useState(0);

  const innerWidth = Math.max(0, width - CHART_PADDING_X * 2);
  const innerHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
  const maxOvr = Math.max(...TIMELINE.map((n) => n.ovr));
  const minOvr = Math.min(...TIMELINE.map((n) => n.ovr));
  const range = Math.max(1, maxOvr - minOvr);

  const points = TIMELINE.map((node, idx) => {
    const x = CHART_PADDING_X + (idx * innerWidth) / (TIMELINE.length - 1);
    // Higher OVR = lower y (top-left origin)
    const y =
      CHART_PADDING_TOP + innerHeight - ((node.ovr - minOvr) / range) * innerHeight;
    return { x, y, node };
  });

  const linePath =
    points.length === 0
      ? ''
      : points.reduce((acc, p, i) => {
          if (i === 0) return `M ${p.x} ${p.y}`;
          // Smooth curve via simple cubic — control points at midpoints
          const prev = points[i - 1];
          const cx = (prev.x + p.x) / 2;
          return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
        }, '');

  const areaPath =
    points.length === 0
      ? ''
      : `${linePath} L ${points[points.length - 1].x} ${
          CHART_PADDING_TOP + innerHeight
        } L ${points[0].x} ${CHART_PADDING_TOP + innerHeight} Z`;

  // Approximate path length for stroke-dash animation
  const pathLength = innerWidth * 1.1; // close enough; over-estimating just hides line slightly longer

  return (
    <View
      style={chartStyles.wrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={CHART_HEIGHT}>
          <Defs>
            <SvgLinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#00D68F" stopOpacity="0.35" />
              <Stop offset="1" stopColor="#00D68F" stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>

          {/* Faint baseline grid (top + bottom) */}
          <Path
            d={`M ${CHART_PADDING_X} ${CHART_PADDING_TOP + innerHeight} L ${
              width - CHART_PADDING_X
            } ${CHART_PADDING_TOP + innerHeight}`}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />

          {/* Animated area fill (clipped via opacity sync to chartProgress) */}
          <AnimatedPath
            d={areaPath}
            fill="url(#areaFill)"
            opacity={chartProgress}
          />

          {/* Animated line: stroke-dash trick to draw from left to right */}
          <AnimatedPath
            d={linePath}
            stroke="#00D68F"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${pathLength}, ${pathLength}`}
            strokeDashoffset={chartProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [pathLength, 0],
            })}
          />

          {/* Data dots */}
          {points.map((p, idx) => {
            const isLast = idx === points.length - 1;
            const tier = RANK_BY_ID[p.node.rankId];
            return (
              <React.Fragment key={p.node.day}>
                <AnimatedCircle
                  cx={p.x}
                  cy={p.y}
                  r={isLast ? DOT_RADIUS_LAST : DOT_RADIUS_DEFAULT}
                  fill={tier.color}
                  opacity={dotOpacities[idx]}
                />
                {isLast && (
                  <AnimatedCircle
                    cx={p.x}
                    cy={p.y}
                    r={DOT_RADIUS_LAST}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    opacity={dotOpacities[idx]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      )}

      {/* X-axis labels overlaid (RN Text on top of SVG) */}
      <View style={chartStyles.xLabels} pointerEvents="none">
        {points.map((p) => {
          const tier = RANK_BY_ID[p.node.rankId];
          return (
            <View
              key={p.node.day}
              style={[
                chartStyles.xLabelCol,
                { left: p.x - 40 }, // 80px wide, centered on point
              ]}
            >
              <Text style={chartStyles.dayLabel}>DAY {p.node.day}</Text>
              <Text style={[chartStyles.rankLabel, { color: tier.color }]}>
                {tier.name}
              </Text>
              <Text style={chartStyles.ovrLabel}>OVR {p.node.ovr}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const chartStyles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: CHART_HEIGHT,
    marginTop: 24,
    position: 'relative',
  },
  xLabels: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 50,
  },
  xLabelCol: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
  },
  dayLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.textMuted,
  },
  rankLabel: {
    marginTop: 4,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  ovrLabel: {
    marginTop: 1,
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: Colors.textSecondary,
  },
});

// ─── Screen ──────────────────────────────────────────────

type Props = NativeStackScreenProps<OnboardingStackParamList, 'TrialPreview'>;

const TrialPreviewScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('TrialPreview');
  const { state } = useOnboarding();

  const hoursPerDay = parseHoursPerDay(state.phoneUsageHours ?? '');
  const totalHoursReclaimed = +(hoursPerDay * RECLAIM_PCT * TRIAL_DAYS).toFixed(1);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(14)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.85)).current;
  const heroCount = useRef(new Animated.Value(0)).current;
  const [displayHours, setDisplayHours] = useState(0);
  const chartProgress = useRef(new Animated.Value(0)).current;
  const dotOpacities = useRef(TIMELINE.map(() => new Animated.Value(0))).current;
  const reminderOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const advancingRef = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.spring(heroScale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
          Animated.timing(heroCount, {
            toValue: totalHoursReclaimed,
            duration: 1200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
        ]).start();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 600),
    );

    // Animate the chart line drawing in
    timers.push(
      setTimeout(() => {
        Animated.timing(chartProgress, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }, 1800),
    );

    // Reveal each data dot as the line passes it
    TIMELINE.forEach((_, idx) => {
      timers.push(
        setTimeout(() => {
          Animated.spring(dotOpacities[idx], {
            toValue: 1,
            friction: 6,
            tension: 80,
            useNativeDriver: true,
          }).start();
          if (idx === TIMELINE.length - 1) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }, 1800 + idx * 350),
      );
    });

    timers.push(
      setTimeout(() => {
        Animated.timing(reminderOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }, 3500),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }, 3900),
    );

    const sub = heroCount.addListener(({ value }) => {
      setDisplayHours(Math.round(value * 10) / 10);
    });

    return () => {
      timers.forEach(clearTimeout);
      heroCount.removeListener(sub);
    };
  }, [
    totalHoursReclaimed,
    headerOpacity,
    headerTranslate,
    heroOpacity,
    heroScale,
    heroCount,
    chartProgress,
    dotOpacities,
    reminderOpacity,
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
    }).start(() => navigation.navigate('Paywall'));
  };

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
            <Text style={styles.eyebrow}>3-DAY PREVIEW</Text>
            <Text style={styles.title}>
              See your evolution{'\n'}before you commit.
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.heroBlock,
              {
                opacity: heroOpacity,
                transform: [{ scale: heroScale }],
              },
            ]}
          >
            <Text style={styles.heroValue}>
              {displayHours.toFixed(1)}
              <Text style={styles.heroUnit}> hrs</Text>
            </Text>
            <Text style={styles.heroLabel}>reclaimed in just 3 days</Text>
          </Animated.View>

          <ProgressionChart
            chartProgress={chartProgress}
            dotOpacities={dotOpacities}
          />

          <Animated.View style={[styles.reminderCard, { opacity: reminderOpacity }]}>
            <View style={styles.reminderIconWrap}>
              <Ionicons name="notifications-outline" size={22} color={Colors.accent} />
            </View>
            <Text style={styles.reminderText}>
              We'll remind you{' '}
              <Text style={styles.reminderAccent}>24 hours before</Text> your trial ends. Cancel anytime — no charges.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            style={styles.cta}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Start my 3-day free trial</Text>
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
    color: Colors.accent,
  },
  title: {
    marginTop: 6,
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    letterSpacing: -0.4,
    lineHeight: 32,
    color: Colors.textPrimary,
  },
  heroBlock: {
    marginTop: 20,
    alignItems: 'center',
  },
  heroValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 44,
    letterSpacing: -0.5,
    color: Colors.success,
    textShadowColor: 'rgba(0,214,143,0.35)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  heroUnit: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 18,
    color: Colors.success,
  },
  heroLabel: {
    marginTop: 4,
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  reminderCard: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(0,194,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,194,255,0.28)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    shadowColor: Colors.accent,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  reminderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,194,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0,194,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
  },
  reminderAccent: {
    color: Colors.accent,
    fontFamily: FontFamily.headingSemiBold,
  },
  buttonWrap: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  cta: {
    backgroundColor: Colors.primary,
    borderRadius: 28,
    paddingVertical: 18,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A66FF',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaText: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    letterSpacing: -0.1,
    color: Colors.textPrimary,
  },
});

export default TrialPreviewScreen;
