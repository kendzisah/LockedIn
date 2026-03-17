import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
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

const MIN_AGE = 13;
const MAX_AGE = 70;
const DEFAULT_AGE = 22;
const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 7;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const AGE_VALUES = Array.from(
  { length: MAX_AGE - MIN_AGE + 1 },
  (_, i) => MIN_AGE + i,
);

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AgeQuiz'>;

export const AgeQuizScreen: React.FC<Props> = ({ navigation }) => {
  useEffect(() => {
    MixpanelService.track('Onboarding Screen Viewed', { screen: 'AgeQuiz', step: 4, total_steps: 18 });
  }, []);

  const { dispatch } = useOnboarding();
  const [selectedAge, setSelectedAge] = useState(DEFAULT_AGE);
  const lastHapticAge = useRef(DEFAULT_AGE);
  const scrollY = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const advancingRef = useRef(false);

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(index, AGE_VALUES.length - 1));
      setSelectedAge(AGE_VALUES[clamped]);
    },
    [],
  );

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.round(y / ITEM_HEIGHT);
        const clamped = Math.max(0, Math.min(index, AGE_VALUES.length - 1));
        const age = AGE_VALUES[clamped];
        if (age !== lastHapticAge.current) {
          lastHapticAge.current = age;
          Haptics.selectionAsync();
        }
      },
    },
  );

  const handleContinue = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    MixpanelService.track('Onboarding Answer Submitted', { screen: 'AgeQuiz', answer: String(selectedAge) });
    dispatch({ type: 'SET_USER_AGE', payload: selectedAge });
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => navigation.navigate('LossAversionStat'));
  };

  const renderItem = useCallback(
    (age: number, index: number) => {
      const inputRange = [
        (index - 3) * ITEM_HEIGHT,
        (index - 2) * ITEM_HEIGHT,
        (index - 1) * ITEM_HEIGHT,
        index * ITEM_HEIGHT,
        (index + 1) * ITEM_HEIGHT,
        (index + 2) * ITEM_HEIGHT,
        (index + 3) * ITEM_HEIGHT,
      ];

      const opacity = scrollY.interpolate({
        inputRange,
        outputRange: [0.06, 0.12, 0.3, 1, 0.3, 0.12, 0.06],
        extrapolate: 'clamp',
      });

      const scale = scrollY.interpolate({
        inputRange,
        outputRange: [0.7, 0.78, 0.88, 1.1, 0.88, 0.78, 0.7],
        extrapolate: 'clamp',
      });

      return (
        <Animated.View
          key={age}
          style={[styles.item, { opacity, transform: [{ scale }] }]}
        >
          <Text style={styles.itemText}>{age}</Text>
        </Animated.View>
      );
    },
    [scrollY],
  );

  const paddingVertical = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
    <ScreenContainer centered={false}>
      <ProgressIndicator current={4} total={17} />

      <View style={styles.content}>
        <View style={styles.headerArea}>
          <Text style={styles.headline}>How old are you?</Text>
          <Text style={styles.subtext}>
            So we can show you exactly what's at stake.
          </Text>
        </View>

        <View style={styles.pickerContainer}>
          <View style={styles.selectionBand} />

          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            bounces={false}
            contentContainerStyle={{
              paddingTop: paddingVertical,
              paddingBottom: paddingVertical,
            }}
            contentOffset={{ x: 0, y: (DEFAULT_AGE - MIN_AGE) * ITEM_HEIGHT }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleMomentumEnd}
          >
            {AGE_VALUES.map((age, i) => renderItem(age, i))}
          </Animated.ScrollView>
        </View>
      </View>

      <View style={styles.footer}>
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

const BAND_TOP = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  headerArea: {
    marginTop: 24,
  },
  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtext: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textMuted,
  },
  pickerContainer: {
    height: PICKER_HEIGHT,
    alignSelf: 'center',
    width: '100%',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  selectionBand: {
    position: 'absolute',
    top: BAND_TOP,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    color: '#FFFFFF',
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
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
});

export default AgeQuizScreen;
