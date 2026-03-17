import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
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

const SLIDE = 25;
const MIN_HOURS = 1;
const MAX_HOURS = 8;
const TOTAL_STEPS = MAX_HOURS - MIN_HOURS;

const KNOB_SIZE = 240;
const CENTER = KNOB_SIZE / 2;
const TRACK_RADIUS = 80;
const INDICATOR_SIZE = 32;
const DOT_COUNT = 60;

function hoursToAngle(hours: number): number {
  return ((hours - MIN_HOURS) / TOTAL_STEPS) * 300 + 30;
}

function angleToHours(angleDeg: number): number {
  let a = ((angleDeg % 360) + 360) % 360;
  const raw = ((a - 30) / 300) * TOTAL_STEPS + MIN_HOURS;
  return Math.max(MIN_HOURS, Math.min(MAX_HOURS, Math.round(raw)));
}

function polarXY(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

type Props = NativeStackScreenProps<OnboardingStackParamList, 'DailyTimeCommitment'>;

const DailyTimeCommitmentScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  const [selectedHours, setSelectedHours] = useState(1);
  const lastHapticHour = useRef(1);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const knobOpacity = useRef(new Animated.Value(0)).current;
  const knobScale = useRef(new Animated.Value(0.8)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  const socialProofOpacity = useRef(new Animated.Value(0)).current;
  const prevInRange = useRef(false);

  const knobRef = useRef<View>(null);
  const knobLayout = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    MixpanelService.track('Onboarding Screen Viewed', { screen: 'DailyTimeCommitment', step: 10, total_steps: 18 });
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(titleTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(knobOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(knobScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
    }, 500);

    setTimeout(() => {
      Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 900);
  }, [titleOpacity, titleTranslateY, knobOpacity, knobScale, buttonOpacity]);

  const isInSweetSpot = selectedHours >= 4 && selectedHours <= 6;

  useEffect(() => {
    if (isInSweetSpot && !prevInRange.current) {
      Animated.timing(socialProofOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } else if (!isInSweetSpot && prevInRange.current) {
      Animated.timing(socialProofOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }
    prevInRange.current = isInSweetSpot;
  }, [isInSweetSpot, socialProofOpacity]);

  const updateFromTouch = useCallback((pageX: number, pageY: number) => {
    const { x, y, w, h } = knobLayout.current;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const dx = pageX - cx;
    const dy = pageY - cy;

    let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    const hours = angleToHours(angle);
    if (hours !== lastHapticHour.current) {
      lastHapticHour.current = hours;
      Haptics.selectionAsync();
    }
    setSelectedHours(hours);
  }, []);

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateFromTouch(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove: (e) => updateFromTouch(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: () => {},
    }),
  [updateFromTouch]);

  const handleContinue = () => {
    const totalMinutes = selectedHours * 60;
    dispatch({ type: 'SET_DAILY_MINUTES', payload: totalMinutes });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    MixpanelService.track('Onboarding Answer Submitted', {
      screen: 'DailyTimeCommitment',
      answer: `${selectedHours} hours`,
      daily_minutes: totalMinutes,
    });

    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('CompoundStat');
    });
  };

  const currentAngle = hoursToAngle(selectedHours);
  const startAngle = hoursToAngle(MIN_HOURS);
  const thumb = polarXY(currentAngle, TRACK_RADIUS);

  // Track dots (background ring)
  const trackDots = useMemo(() => {
    const dots = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      const a = (i / DOT_COUNT) * 360;
      const { x, y } = polarXY(a, TRACK_RADIUS);
      dots.push(
        <View
          key={`t${i}`}
          style={[
            styles.trackDot,
            { left: x - 2, top: y - 2 },
          ]}
        />,
      );
    }
    return dots;
  }, []);

  // Active arc dots
  const activeDots = useMemo(() => {
    const dots = [];
    const sweep = currentAngle - startAngle;
    if (sweep <= 0) return dots;

    const count = Math.max(2, Math.round((sweep / 360) * DOT_COUNT));
    for (let i = 0; i <= count; i++) {
      const a = startAngle + (i / count) * sweep;
      const { x, y } = polarXY(a, TRACK_RADIUS);
      dots.push(
        <View
          key={`a${i}`}
          style={[
            styles.activeDot,
            { left: x - 3, top: y - 3 },
          ]}
        />,
      );
    }
    return dots;
  }, [currentAngle, startAngle]);

  // Hour tick labels
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let h = MIN_HOURS; h <= MAX_HOURS; h++) {
      const a = hoursToAngle(h);
      const { x, y } = polarXY(a, TRACK_RADIUS + 32);
      const isSelected = h === selectedHours;
      const isActive = h <= selectedHours;
      labels.push(
        <Text
          key={h}
          style={[
            styles.hourLabel,
            { left: x - 12, top: y - 12 },
            isActive && styles.hourLabelActive,
            isSelected && styles.hourLabelSelected,
          ]}
        >
          {h}
        </Text>,
      );
    }
    return labels;
  }, [selectedHours]);

  // Hour tick marks
  const hourTicks = useMemo(() => {
    const ticks = [];
    for (let h = MIN_HOURS; h <= MAX_HOURS; h++) {
      const a = hoursToAngle(h);
      const inner = polarXY(a, TRACK_RADIUS + 12);
      const isActive = h <= selectedHours;
      ticks.push(
        <View
          key={`tick${h}`}
          style={[
            styles.tickMark,
            {
              left: inner.x - 1.5,
              top: inner.y - 5,
              transform: [{ rotate: `${a}deg` }],
            },
            isActive && styles.tickMarkActive,
          ]}
        />,
      );
    }
    return ticks;
  }, [selectedHours]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <ProgressIndicator current={10} total={17} />

        <View style={styles.body}>
          <Animated.Text
            style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }]}
          >
            How many hours do you{'\n'}want to lock in daily?
          </Animated.Text>

          <Animated.View
            style={[styles.knobSection, { opacity: knobOpacity, transform: [{ scale: knobScale }] }]}
          >
            <View
              ref={knobRef}
              style={styles.knobContainer}
              onLayout={() => {
                knobRef.current?.measureInWindow((x, y, w, h) => {
                  knobLayout.current = { x, y, w, h };
                });
              }}
              {...panResponder.panHandlers}
            >
              {/* Track dots */}
              {trackDots}

              {/* Active arc */}
              {activeDots}

              {/* Tick marks */}
              {hourTicks}

              {/* Hour labels */}
              {hourLabels}

              {/* Thumb / indicator */}
              <View
                style={[
                  styles.thumb,
                  {
                    left: thumb.x - INDICATOR_SIZE / 2,
                    top: thumb.y - INDICATOR_SIZE / 2,
                  },
                ]}
              />

              {/* Center display */}
              <View style={styles.centerContent} pointerEvents="none">
                <Text style={styles.centerNumber}>{selectedHours}</Text>
                <Text style={styles.centerUnit}>{selectedHours === 1 ? 'hour' : 'hours'}</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.Text style={[styles.hintText, { opacity: knobOpacity }]}>
            <Text style={styles.hintBold}>{selectedHours} {selectedHours === 1 ? 'hour' : 'hours'}</Text> of time dedicated to{'\n'}staying locked in per day
          </Animated.Text>

          <Animated.Text style={[styles.socialProof, { opacity: socialProofOpacity }]}>
            Most people start with 4–6 hours
          </Animated.Text>

          <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
            <TouchableOpacity
              onPress={handleContinue}
              activeOpacity={0.9}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Continue</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 48,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 36,
    color: Colors.textPrimary,
    marginBottom: 24,
  },
  knobSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  knobContainer: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    position: 'relative',
  },
  trackDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  activeDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    opacity: 0.6,
  },
  tickMark: {
    position: 'absolute',
    width: 3,
    height: 10,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tickMarkActive: {
    backgroundColor: Colors.accent,
    opacity: 0.5,
  },
  hourLabel: {
    position: 'absolute',
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.2)',
  },
  hourLabelActive: {
    color: 'rgba(255,255,255,0.5)',
  },
  hourLabelSelected: {
    color: Colors.accent,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 15,
  },
  thumb: {
    position: 'absolute',
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: Colors.accent,
    borderWidth: 3,
    borderColor: Colors.background,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerNumber: {
    fontFamily: FontFamily.headingBold,
    fontSize: 52,
    color: Colors.textPrimary,
    letterSpacing: -1.5,
  },
  centerUnit: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: -6,
  },
  hintText: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  hintBold: {
    fontFamily: FontFamily.headingSemiBold,
    color: Colors.textPrimary,
  },
  socialProof: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.accent,
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 16,
    opacity: 0.8,
  },
  buttonWrap: {
    marginTop: 'auto',
    paddingBottom: 32,
    paddingHorizontal: 4,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: 0.5,
    color: Colors.textPrimary,
  },
});

export default DailyTimeCommitmentScreen;
