import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Platform,
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
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { MixpanelService } from '../../../services/MixpanelService';

const MIN_HOURS = 1;
const MAX_HOURS = 12;
const DEFAULT_HOURS = 2;
const THUMB_SIZE = 28;
const CIRCLE_BTN = 44;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PhoneTimeQuiz'>;

const PhoneTimeQuizScreen: React.FC<Props> = ({ navigation }) => {
  useEffect(() => {
    MixpanelService.track('Onboarding Screen Viewed', { screen: 'PhoneTimeQuiz', step: 3, total_steps: 17 });
  }, []);

  const { dispatch } = useOnboarding();
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const advancingRef = useRef(false);

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const trackWidth = useRef(0);
  const trackPageX = useRef(0);
  const lastSnapped = useRef(DEFAULT_HOURS);
  const thumbX = useRef(new Animated.Value(0)).current;

  const hoursToX = useCallback(
    (h: number, width: number) =>
      ((h - MIN_HOURS) / (MAX_HOURS - MIN_HOURS)) * width,
    [],
  );

  const xToHours = useCallback((x: number, width: number) => {
    const ratio = Math.max(0, Math.min(1, x / width));
    return Math.round(ratio * (MAX_HOURS - MIN_HOURS) + MIN_HOURS);
  }, []);

  const updateTo = useCallback(
    (h: number) => {
      const clamped = Math.max(MIN_HOURS, Math.min(MAX_HOURS, h));
      setHours(clamped);
      lastSnapped.current = clamped;
      Animated.spring(thumbX, {
        toValue: hoursToX(clamped, trackWidth.current),
        friction: 7,
        tension: 120,
        useNativeDriver: false,
      }).start();
      Haptics.selectionAsync();
    },
    [thumbX, hoursToX],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.pageX - trackPageX.current;
        const h = xToHours(x, trackWidth.current);
        lastSnapped.current = h;
        setHours(h);
        thumbX.setValue(hoursToX(h, trackWidth.current));
        Haptics.selectionAsync();
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.pageX - trackPageX.current;
        const h = xToHours(x, trackWidth.current);
        thumbX.setValue(hoursToX(h, trackWidth.current));
        if (h !== lastSnapped.current) {
          lastSnapped.current = h;
          setHours(h);
          Haptics.selectionAsync();
        }
      },
      onPanResponderRelease: (evt) => {
        const x = evt.nativeEvent.pageX - trackPageX.current;
        const h = xToHours(x, trackWidth.current);
        updateTo(h);
      },
    }),
  ).current;

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width } = e.nativeEvent.layout;
      trackWidth.current = width;
      e.target.measureInWindow((pageX: number) => {
        trackPageX.current = pageX;
      });
      thumbX.setValue(hoursToX(hours, width));
    },
    [hoursToX, hours, thumbX],
  );

  const fadeAndNavigate = useCallback(
    (payload: string) => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      dispatch({ type: 'SET_PHONE_USAGE', payload });
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => navigation.navigate('AgeQuiz'));
    },
    [dispatch, screenOpacity, navigation],
  );

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    MixpanelService.track('Onboarding Answer Submitted', { screen: 'PhoneTimeQuiz', answer: `${hours} hours` });
    fadeAndNavigate(`${hours} hours`);
  };

  const handleDontKnow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    MixpanelService.track('Onboarding Answer Submitted', { screen: 'PhoneTimeQuiz', answer: 'unknown' });
    fadeAndNavigate('unknown');
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
    <ScreenContainer centered={false}>
      <ProgressIndicator current={3} total={17} />

      <View style={styles.body}>
        <Text style={styles.title}>
          How much time do you{'\n'}spend on your phone?
        </Text>


        <View style={styles.displayArea}>
          <Text style={styles.bigNumber}>{hours}</Text>
          <Text style={styles.unitLabel}>Hours</Text>
        </View>

        <View style={styles.sliderRow}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => updateTo(hours - 1)}
            activeOpacity={0.6}
          >
            <Text style={styles.circleBtnText}>−</Text>
          </TouchableOpacity>

          <View style={styles.trackContainer} {...panResponder.panHandlers}>
            <View style={styles.track} onLayout={handleLayout}>
              <Animated.View style={[styles.trackFill, { width: thumbX }]} />
              <Animated.View
                style={[
                  styles.thumb,
                  {
                    transform: [
                      { translateX: Animated.subtract(thumbX, THUMB_SIZE / 2) },
                    ],
                  },
                ]}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => updateTo(hours + 1)}
            activeOpacity={0.6}
          >
            <Text style={styles.circleBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleDontKnow}
          activeOpacity={0.7}
          style={styles.dontKnowBtn}
        >
          <Text style={styles.dontKnowText}>I don't know</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.85}
          style={styles.continueBtn}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
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
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    lineHeight: 34,
    color: Colors.textPrimary,
    marginBottom: 10,
  },

  displayArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigNumber: {
    fontFamily: FontFamily.headingBold,
    fontSize: 72,
    color: Colors.textPrimary,
  },
  unitLabel: {
    fontFamily: FontFamily.body,
    fontSize: 17,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 48,
  },
  circleBtn: {
    width: CIRCLE_BTN,
    height: CIRCLE_BTN,
    borderRadius: CIRCLE_BTN / 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleBtnText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: 'rgba(255,255,255,0.55)',
    marginTop: -1,
  },
  trackContainer: {
    flex: 1,
    justifyContent: 'center',
    height: 44,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surface,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  thumb: {
    position: 'absolute',
    top: -(THUMB_SIZE - 4) / 2,
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  dontKnowBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  dontKnowText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  continueBtn: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  continueBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
  },
});

export default PhoneTimeQuizScreen;
