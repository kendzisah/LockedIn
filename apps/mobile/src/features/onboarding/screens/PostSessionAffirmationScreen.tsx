import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { MixpanelService } from '../../../services/MixpanelService';
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 25;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PostSessionAffirmation'>;

const PostSessionAffirmationScreen: React.FC<Props> = ({ navigation }) => {
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    MixpanelService.track('Onboarding Screen Viewed', { screen: 'PostSessionAffirmation', step: 15, total_steps: 18 });
  }, []);

  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineScale = useRef(new Animated.Value(0.95)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const bodyTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const repeatOpacity = useRef(new Animated.Value(0)).current;
  const statOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(headlineOpacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.spring(headlineScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();

    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(bodyOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(bodyTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 1000));

    timers.push(setTimeout(() => {
      Animated.timing(repeatOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 2000));

    timers.push(setTimeout(() => {
      Animated.timing(statOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 2800));

    timers.push(setTimeout(() => {
      Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 3500));

    timers.push(setTimeout(async () => {
      if (await StoreReview.hasAction()) {
        StoreReview.requestReview();
      }
    }, 4000));

    return () => timers.forEach(clearTimeout);
  }, [headlineOpacity, headlineScale, bodyOpacity, bodyTranslateY, repeatOpacity, statOpacity, buttonOpacity]);

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
      navigation.navigate('NotificationPreFrame');
    });
  }, [screenOpacity, navigation]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer>
        <ProgressIndicator current={16} total={19} />

        <View style={styles.body}>
          <Animated.Text
            style={[styles.title, { opacity: headlineOpacity, transform: [{ scale: headlineScale }] }]}
          >
            That's control.
          </Animated.Text>

          <Animated.Text
            style={[styles.bodyLine, { opacity: bodyOpacity, transform: [{ translateY: bodyTranslateY }] }]}
          >
            You just chose <Text style={styles.emphasis}>discipline</Text> over impulse.
          </Animated.Text>

          <Animated.Text style={[styles.repeat, { opacity: repeatOpacity }]}>
            Repeat this daily.
          </Animated.Text>

          <Animated.Text style={[styles.stat, { opacity: statOpacity }]}>
            2 minutes in. 89 days, 23 hours, 58 minutes to go.
          </Animated.Text>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity onPress={handleContinue} activeOpacity={0.7} style={styles.continueButton}>
            <Text style={styles.continueText}>Continue →</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center' },
  title: { fontFamily: FontFamily.headingBold, fontSize: 36, letterSpacing: -0.8, lineHeight: 42, color: Colors.textPrimary, marginBottom: 16 },
  bodyLine: { fontFamily: FontFamily.body, fontSize: 16, lineHeight: 24, color: Colors.textPrimary, marginBottom: 10 },
  emphasis: { color: Colors.primary, fontFamily: FontFamily.bodyMedium },
  repeat: { fontFamily: FontFamily.bodyMedium, fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginBottom: 20 },
  stat: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, color: Colors.textMuted, opacity: 0.7 },
  buttonWrap: { paddingBottom: 32, alignItems: 'flex-end' },
  continueButton: { paddingVertical: 12, paddingHorizontal: 8 },
  continueText: { fontFamily: FontFamily.bodyMedium, color: Colors.textSecondary, fontSize: 17 },
});

export default PostSessionAffirmationScreen;
