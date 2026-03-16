import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import OptionItem from '../../../design/components/OptionItem';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { MixpanelService } from '../../../services/MixpanelService';

const SLIDE = 25;

const GOALS = [
  'Build a business or side project',
  'Advance my career',
  'Improve my physique',
  'Increase discipline & self-control',
  'Reduce distractions',
  'Improve emotional control',
  'Study with consistency',
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'GoalQuiz'>;

const GoalQuizScreen: React.FC<Props> = ({ navigation }) => {
  useEffect(() => {
    MixpanelService.track('Onboarding Screen Viewed', { screen: 'GoalQuiz', step: 6, total_steps: 18 });
  }, []);

  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);
  const advancingRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(SLIDE)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(titleTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    timers.push(setTimeout(() => {
      Animated.timing(subtextOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 600));

    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(optionsOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(optionsTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }, 1000));

    return () => timers.forEach(clearTimeout);
  }, [titleOpacity, titleTranslateY, subtextOpacity, optionsOpacity, optionsTranslateY]);

  const handleSelect = (goal: string) => {
    if (advancingRef.current) return;
    setSelected(goal);
    dispatch({ type: 'SET_PRIMARY_GOAL', payload: goal });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    MixpanelService.track('Onboarding Answer Submitted', { screen: 'GoalQuiz', answer: goal });

    advancingRef.current = true;
    setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        navigation.navigate('ControlQuiz');
      });
    }, 400);
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <ProgressIndicator current={7} total={19} />

        <View style={styles.body}>
          <Animated.Text
            style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }]}
          >
            What are you building{'\n'}over the next 90 days?
          </Animated.Text>

          <Animated.View style={{ opacity: subtextOpacity }}>
            <Text style={styles.subtextLine}>Locked In is a tool.</Text>
            <Text style={styles.subtextEmphasis}>
              Your direction determines the outcome.
            </Text>
          </Animated.View>

          <Animated.View
            style={[styles.options, { opacity: optionsOpacity, transform: [{ translateY: optionsTranslateY }] }]}
          >
            {GOALS.map((goal) => (
              <OptionItem
                key={goal}
                label={goal}
                selected={selected === goal}
                onPress={() => handleSelect(goal)}
              />
            ))}
          </Animated.View>
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
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 36,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  subtextLine: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  subtextEmphasis: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
    marginBottom: 28,
  },
  options: {
    marginBottom: 16,
  },
});

export default GoalQuizScreen;
