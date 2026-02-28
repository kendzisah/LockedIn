import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

const SLIDE = 25;

const GOALS = [
  'Build a business or side project',
  'Advance my career',
  'Improve my physique',
  'Increase discipline & self-control',
  'Reduce distractions',
  'Improve emotional control',
  'Study with consistency',
  'Strengthen my routine',
  'Improve confidence',
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Projection'>;

const ProjectionScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customGoal, setCustomGoal] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    timers.push(
      setTimeout(() => {
        Animated.timing(subtextOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 600),
    );

    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(optionsOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(optionsTranslateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1000),
    );

    timers.push(
      setTimeout(() => {
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 1600),
    );

    return () => timers.forEach(clearTimeout);
  }, [
    titleOpacity,
    titleTranslateY,
    subtextOpacity,
    optionsOpacity,
    optionsTranslateY,
    buttonOpacity,
  ]);

  const toggleGoal = useCallback((goal: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(goal)) {
        next.delete(goal);
      } else {
        next.add(goal);
      }
      return next;
    });
  }, []);

  const toggleOther = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCustomInput((prev) => !prev);
    if (showCustomInput) {
      setCustomGoal('');
    }
  }, [showCustomInput]);

  const hasSelection = selected.size > 0 || (showCustomInput && customGoal.trim().length > 0);

  const handleContinue = useCallback(() => {
    if (!hasSelection) return;

    const goals = [...selected];
    if (showCustomInput && customGoal.trim()) {
      goals.push(customGoal.trim());
    }

    dispatch({ type: 'SET_GOALS', payload: goals });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('ScreenTimePermission');
    });
  }, [hasSelection, selected, showCustomInput, customGoal, dispatch, screenOpacity, navigation]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <ProgressIndicator current={8} total={13} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
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
            style={[
              styles.options,
              {
                opacity: optionsOpacity,
                transform: [{ translateY: optionsTranslateY }],
              },
            ]}
          >
            {GOALS.map((goal) => {
              const isSelected = selected.has(goal);
              return (
                <TouchableOpacity
                  key={goal}
                  style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                  onPress={() => toggleGoal(goal)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      isSelected && styles.optionLabelSelected,
                    ]}
                  >
                    {goal}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Other option */}
            <TouchableOpacity
              style={[
                styles.optionItem,
                showCustomInput && styles.optionItemSelected,
              ]}
              onPress={toggleOther}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.optionLabel,
                  showCustomInput && styles.optionLabelSelected,
                ]}
              >
                Other
              </Text>
            </TouchableOpacity>

            {showCustomInput && (
              <TextInput
                style={styles.customInput}
                placeholder="What's your goal?"
                placeholderTextColor={Colors.textMuted}
                value={customGoal}
                onChangeText={setCustomGoal}
                autoFocus
                returnKeyType="done"
                maxLength={100}
              />
            )}
          </Animated.View>
        </ScrollView>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.7}
            disabled={!hasSelection}
            style={styles.continueButton}
          >
            <Text
              style={[
                styles.continueText,
                !hasSelection && styles.continueTextDisabled,
              ]}
            >
              Continue →
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 32,
    paddingBottom: 16,
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
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  optionLabelSelected: {
    color: Colors.textPrimary,
  },
  customInput: {
    borderWidth: 1,
    borderColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
    backgroundColor: Colors.backgroundSecondary,
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  buttonWrap: {
    paddingBottom: 32,
    alignItems: 'flex-end',
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  continueText: {
    fontFamily: FontFamily.bodyMedium,
    color: Colors.textSecondary,
    fontSize: 17,
  },
  continueTextDisabled: {
    color: Colors.textMuted,
  },
});

export default ProjectionScreen;
