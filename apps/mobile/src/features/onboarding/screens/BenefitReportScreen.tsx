import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import BenefitTemplate from '../components/BenefitTemplate';
import { useOnboarding } from '../state/OnboardingProvider';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'BenefitReport'>;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type StatKey = 'discipline' | 'focus' | 'execution' | 'consistency' | 'social';

interface StatRow {
  key: StatKey;
  label: string;
  value: number;
  color: string;
}

const STAT_META: Record<StatKey, { label: string; color: string }> = {
  discipline:  { label: 'Discipline',  color: '#3A66FF' },
  focus:       { label: 'Focus',       color: '#00C2FF' },
  execution:   { label: 'Execution',   color: '#00D68F' },
  consistency: { label: 'Consistency', color: '#FFC857' },
  social:      { label: 'Social',      color: '#A855F7' },
};

/**
 * Map the user's primary goal to the two stats it boosts most. Source is
 * the spec's MISSIONS-STAT mapping table (see onboarding-hud-spec.md).
 */
const GOAL_TO_STATS: Record<string, [StatKey, StatKey]> = {
  'Improve my physique':                ['discipline', 'consistency'],
  'Build a business or side project':   ['execution',  'focus'],
  'Increase discipline & self-control': ['discipline', 'focus'],
  'Advance my career':                  ['execution',  'consistency'],
  'Study with consistency':             ['focus',      'consistency'],
  'Reduce distractions':                ['focus',      'discipline'],
  'Improve emotional control':          ['discipline', 'execution'],
};

/** A weakness pulls its targeted stat up further (the user has been
 * grinding on their weak point). Source is the spec's weakness mapping. */
const WEAKNESS_TO_STAT: Record<string, StatKey> = {
  'I scroll when I should execute':  'focus',
  'I start strong, then fall off':   'consistency',
  'I get emotionally reactive':      'discipline',
  'I relapse into distractions':     'focus',
  'I lack daily consistency':        'consistency',
};

const ALL_STATS: StatKey[] = ['discipline', 'focus', 'execution', 'consistency', 'social'];

/**
 * Project the user's stat profile at Day 90. Numbers are aspirational —
 * they show what consistent execution unlocks given the user's chosen
 * focus areas. Primary > Secondary > others, with weakness picks getting
 * an extra bump.
 */
function projectStats(
  primaryGoal: string | null,
  weaknesses: string[],
): StatRow[] {
  const [primary, secondary] = GOAL_TO_STATS[primaryGoal ?? ''] ?? ['discipline', 'focus'];
  const weaknessStats = new Set(
    weaknesses.map((w) => WEAKNESS_TO_STAT[w]).filter(Boolean) as StatKey[],
  );

  const score = (key: StatKey): number => {
    let base: number;
    if (key === primary) base = 78;
    else if (key === secondary) base = 72;
    else if (key === 'social') base = 58;
    else base = 64;
    if (weaknessStats.has(key)) base = Math.min(85, base + 4);
    return base;
  };

  return ALL_STATS.map((key) => ({
    key,
    label: STAT_META[key].label,
    color: STAT_META[key].color,
    value: score(key),
  }));
}

const BORDER_RADIUS = 18;
const STROKE_WIDTH = 2;

interface ReportCardProps {
  stats: StatRow[];
  ovr: number;
  rankName: string;
  rankColor: string;
  sessions: number;
  minutes: number;
}

const ReportCard: React.FC<ReportCardProps> = ({
  stats,
  ovr,
  rankName,
  rankColor,
  sessions,
  minutes,
}) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const dashOffset = useRef(new Animated.Value(0)).current;

  // Approximate perimeter of rounded rect
  const perimeter = size.w > 0
    ? 2 * (size.w + size.h - 4 * BORDER_RADIUS) + 2 * Math.PI * BORDER_RADIUS
    : 0;

  useEffect(() => {
    if (perimeter <= 0) return;
    dashOffset.setValue(0);
    Animated.loop(
      Animated.timing(dashOffset, {
        toValue: -perimeter,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ).start();
  }, [perimeter, dashOffset]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  // Lit segment ~15% of perimeter
  const litLength = perimeter * 0.15;
  const dashArray = perimeter > 0 ? [litLength, perimeter - litLength].join(',') : undefined;

  return (
    <View style={styles.cardWrap} onLayout={onLayout}>
      {/* Light-trail SVG border behind the content */}
      {size.w > 0 && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={size.w} height={size.h}>
            <Defs>
              <LinearGradient id="trail" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#3A66FF" stopOpacity="0" />
                <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#3A66FF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {/* Static dim border behind */}
            <Rect
              x={STROKE_WIDTH / 2}
              y={STROKE_WIDTH / 2}
              width={size.w - STROKE_WIDTH}
              height={size.h - STROKE_WIDTH}
              rx={BORDER_RADIUS}
              ry={BORDER_RADIUS}
              fill="transparent"
              stroke="rgba(58,102,255,0.18)"
              strokeWidth={STROKE_WIDTH}
            />
            {/* Animated trailing-light overlay */}
            <AnimatedRect
              x={STROKE_WIDTH / 2}
              y={STROKE_WIDTH / 2}
              width={size.w - STROKE_WIDTH}
              height={size.h - STROKE_WIDTH}
              rx={BORDER_RADIUS}
              ry={BORDER_RADIUS}
              fill="transparent"
              stroke="url(#trail)"
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset as unknown as number}
              strokeLinecap="round"
            />
          </Svg>
        </View>
      )}

      <View style={styles.cardInner}>
        <Text style={styles.cardHeader}>SYSTEM REPORT — DAY 90</Text>

        <View style={styles.gradeBlock}>
          <Text style={styles.gradeLabel}>GRADE</Text>
          <Text style={styles.grade}>S</Text>
        </View>

        <View style={styles.ovrRow}>
          <Text style={styles.ovrLabel}>OVR</Text>
          <Text style={styles.ovrValue}>{ovr}</Text>
          <Text style={[styles.ovrRank, { color: rankColor }]}>{rankName}</Text>
        </View>

        <View style={styles.statsBlock}>
          {stats.map((row) => (
            <View key={row.label} style={styles.statRow}>
              <Text style={styles.statLabel}>{row.label}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${row.value}%`,
                      backgroundColor: row.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.statValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.metricsRow}>
          <Metric label="Sessions" value={String(sessions)} />
          <Metric label="Minutes" value={minutes.toLocaleString()} />
          <Metric label="Streak" value="90" />
        </View>

        <View style={styles.footnoteRow}>
          <Ionicons name="flash" size={12} color={Colors.warning} />
          <Text style={styles.footnote}>
            "Elite focus. You outperformed 94% of users this week."
          </Text>
        </View>
      </View>
    </View>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const BenefitReportScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('BenefitReport');
  const { state } = useOnboarding();

  const projection = useMemo(() => {
    const stats = projectStats(state.primaryGoal, state.selectedWeaknesses);
    const ovr = Math.round(
      stats.reduce((sum, s) => sum + s.value, 0) / stats.length,
    );
    // 90-day model: assume one session per day at the user's chosen
    // commitment. Falls back to 30 min if not set yet.
    const dailyMin = state.dailyMinutes ?? 30;
    const sessions = 90;
    const minutes = sessions * dailyMin;
    return {
      stats,
      ovr,
      // At Day 90 the user lands in LEGEND tier.
      rankName: 'LEGEND',
      rankColor: '#A855F7',
      sessions,
      minutes,
    };
  }, [state.primaryGoal, state.selectedWeaknesses, state.dailyMinutes]);

  return (
    <BenefitTemplate
      panelLabel="DAY 90 PROJECTION"
      step={14}
      headline="THIS IS YOU IN 90 DAYS"
      headlineColor={Colors.warning}
      body="Show up daily and your stats compound around the goal you picked. This is your character at Day 90 — not a hypothetical, the projection from your answers."
      callout="If you stay locked in."
      calloutColor="#A855F7"
      graphic={<ReportCard {...projection} />}
      onContinue={() => navigation.navigate('ScreenTimePreFrame')}
    />
  );
};

const styles = StyleSheet.create({
  cardWrap: {
    width: '100%',
    backgroundColor: 'rgba(21,26,33,0.72)',
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 16,
  },
  cardHeader: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  gradeBlock: {
    alignItems: 'center',
    marginTop: 8,
  },
  gradeLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.textMuted,
  },
  grade: {
    fontFamily: FontFamily.headingBold,
    fontSize: 56,
    color: Colors.warning,
    textShadowColor: 'rgba(255,200,87,0.4)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  ovrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
  },
  ovrLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.textSecondary,
  },
  ovrValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.textPrimary,
  },
  ovrRank: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: Colors.success,
  },
  statsBlock: {
    marginTop: 12,
    gap: 6,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    width: 80,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  statValue: {
    width: 24,
    textAlign: 'right',
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 11,
    color: Colors.textPrimary,
  },
  metricsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  metricLabel: {
    marginTop: 2,
    fontFamily: FontFamily.body,
    fontSize: 10,
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  footnoteRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footnote: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default BenefitReportScreen;
