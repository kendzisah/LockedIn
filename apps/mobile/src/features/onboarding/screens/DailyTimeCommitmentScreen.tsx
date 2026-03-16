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

const SLIDE = 25;

const OPTIONS = [
  '5 minutes',
  '10 minutes',
  '15 minutes',
  '20+ minutes',
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'DailyTimeCommitment'>;

const DailyTimeCommitmentScreen: React.FC<Props> = ({ navigation }) => {
  const { dispatch } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);
  const advancingRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(SLIDE)).current;

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

    return () => timers.forEach(clearTimeout);
  }, [titleOpacity, titleTranslateY, optionsOpacity, optionsTranslateY]);

  const handleSelect = (option: string) => {
    if (advancingRef.current) return;
    setSelected(option);
    dispatch({ type: 'SET_DAILY_MINUTES', payload: option });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    advancingRef.current = true;
    setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        navigation.navigate('CompoundStat');
      });
    }, 300);
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <ProgressIndicator current={9} total={19} />

        <View style={styles.body}>
          <Animated.Text
            style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }]}
          >
            How much time can you{'\n'}dedicate daily?
          </Animated.Text>

          <Animated.View
            style={[styles.options, { opacity: optionsOpacity, transform: [{ translateY: optionsTranslateY }] }]}
          >
            {OPTIONS.map((option) => (
              <OptionItem
                key={option}
                label={option}
                selected={selected === option}
                onPress={() => handleSelect(option)}
              />
            ))}

            <Text style={styles.hint}>Most people start with 15 minutes</Text>
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
    marginBottom: 28,
  },
  options: {
    marginBottom: 16,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default DailyTimeCommitmentScreen;
