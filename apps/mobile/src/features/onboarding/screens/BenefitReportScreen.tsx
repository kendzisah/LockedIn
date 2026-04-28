import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import BenefitTemplate from '../components/BenefitTemplate';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'BenefitReport'>;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const STAT_ROWS: { label: string; value: number; color: string }[] = [
  { label: 'Discipline',  value: 78, color: '#3A66FF' },
  { label: 'Focus',       value: 71, color: '#00C2FF' },
  { label: 'Execution',   value: 69, color: '#00D68F' },
  { label: 'Consistency', value: 82, color: '#FFC857' },
  { label: 'Social',      value: 58, color: '#A855F7' },
];

const BORDER_RADIUS = 18;
const STROKE_WIDTH = 2;

const ReportCard: React.FC = () => {
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
        <Text style={styles.cardHeader}>WEEKLY SYSTEM REPORT — WEEK 12</Text>

        <View style={styles.gradeBlock}>
          <Text style={styles.gradeLabel}>GRADE</Text>
          <Text style={styles.grade}>S</Text>
        </View>

        <View style={styles.ovrRow}>
          <Text style={styles.ovrLabel}>OVR</Text>
          <Text style={styles.ovrValue}>72</Text>
          <Text style={styles.ovrRank}>CHOSEN</Text>
        </View>

        <View style={styles.statsBlock}>
          {STAT_ROWS.map((row) => (
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
          <Metric label="Sessions" value="14" />
          <Metric label="Minutes" value="420" />
          <Metric label="Streak" value="90" />
        </View>

        <Text style={styles.footnote}>
          ⚡ "Elite focus. You outperformed 94% of users this week."
        </Text>
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
  return (
    <BenefitTemplate
      panelLabel="WEEKLY REPORT"
      step={14}
      headline="WEEKLY REPORTS"
      headlineColor={Colors.warning}
      body='Every Sunday the system grades your week. This is what consistent execution looks like after 90 days. The only question — will you be the one who gets here?'
      graphic={<ReportCard />}
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
  footnote: {
    marginTop: 12,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default BenefitReportScreen;
