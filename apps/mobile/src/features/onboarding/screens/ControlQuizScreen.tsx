import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';

import { Analytics } from '../../../services/AnalyticsService';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily, Typography } from '../../../design/typography';

const AF_LEAD_SENT_KEY = '@lockedin/af_lead_sent';
const SLIDE = 30;

const WEAKNESSES = [
  'I scroll when I should execute',
  'I start strong, then fall off',
  'I get emotionally reactive',
  'I relapse into distractions',
  'I lack daily consistency',
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ControlQuiz'>;

const ControlQuizScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const hintShown = useRef(false);
  const advancingRef = useRef(false);
  const autoNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useOnboardingTracking('ControlQuiz');

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(titleTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(optionsOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(optionsTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }, 1000));

    return () => {
      timers.forEach(clearTimeout);
      if (autoNavTimer.current) clearTimeout(autoNavTimer.current);
    };
  }, [titleOpacity, titleTranslateY, optionsOpacity, optionsTranslateY]);

  const advance = useCallback(async () => {
    if (advancingRef.current) return;
    const sel = selectedRef.current;
    if (sel.size === 0) return;
    advancingRef.current = true;

    dispatch({ type: 'SET_WEAKNESSES', payload: [...sel] });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const sent = await AsyncStorage.getItem(AF_LEAD_SENT_KEY);
      if (!sent) {
        Analytics.trackAF('lead', { af_content: 'control_quiz' });
        await AsyncStorage.setItem(AF_LEAD_SENT_KEY, '1');
      }
    } catch {}

    Analytics.track('Onboarding Answer Submitted', { screen: 'ControlQuiz', answer: [...selectedRef.current].join(', ') });
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('DailyTimeCommitment');
    });
  }, [dispatch, screenOpacity, navigation]);

  const handleToggle = useCallback((point: string) => {
    if (advancingRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(point)) {
        next.delete(point);
      } else {
        next.add(point);
      }

      if (next.size >= 2 && !hintShown.current) {
        hintShown.current = true;
        Animated.timing(hintOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }

      if (autoNavTimer.current) clearTimeout(autoNavTimer.current);
      if (next.size > 0) {
        autoNavTimer.current = setTimeout(() => advance(), 1800);
      }

      return next;
    });
  }, [hintOpacity, advance]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <ProgressIndicator current={6} total={10} />

        <View style={styles.body}>
          <Animated.Text
            style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }]}
          >
            Where are you losing control?
          </Animated.Text>

          <Animated.View
            style={[styles.options, { opacity: optionsOpacity, transform: [{ translateY: optionsTranslateY }] }]}
          >
            {WEAKNESSES.map((point) => {
              const isSelected = selected.has(point);
              return (
                <TouchableOpacity
                  key={point}
                  style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                  onPress={() => handleToggle(point)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {point}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Animated.Text style={[styles.hint, { opacity: hintOpacity }]}>
              Most people here pick 2–3
            </Animated.Text>
          </Animated.View>
        </View>

        <View style={styles.spacer} />
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
    ...Typography.heading,
    color: Colors.textPrimary,
    marginBottom: 24,
  },
  options: {
    marginBottom: 16,
  },
  optionItem: {
    borderWidth: 1,
    borderColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
    backgroundColor: Colors.backgroundSecondary,
  },
  optionItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  optionLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  optionLabelSelected: {
    color: Colors.textPrimary,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  spacer: { height: 32 },
});

export default ControlQuizScreen;
