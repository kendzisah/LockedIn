import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { Analytics } from '../../../services/AnalyticsService';
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const SLIDE = 25;
const TRIPLET_STAGGER = 120;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NinetyDayVision'>;

const NinetyDayVisionScreen: React.FC<Props> = ({ navigation }) => {
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const morningOpacity = useRef(new Animated.Value(0)).current;
  const morningTranslateY = useRef(new Animated.Value(SLIDE)).current;
  const eveningOpacity = useRef(new Animated.Value(0)).current;
  const eveningTranslateY = useRef(new Animated.Value(SLIDE)).current;

  const focusOpacity = useRef(new Animated.Value(0)).current;
  const confidenceOpacity = useRef(new Animated.Value(0)).current;
  const positionOpacity = useRef(new Animated.Value(0)).current;

  const closingOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Analytics.track('Onboarding Screen Viewed', { screen: 'NinetyDayVision', step: 12, total_steps: 18 });
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(titleTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(morningOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(morningTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 900));

    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(eveningOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(eveningTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 1800));

    // Triplet stagger at 120ms
    timers.push(setTimeout(() => {
      Animated.timing(focusOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 2800));
    timers.push(setTimeout(() => {
      Animated.timing(confidenceOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 2800 + TRIPLET_STAGGER));
    timers.push(setTimeout(() => {
      Animated.timing(positionOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 2800 + TRIPLET_STAGGER * 2));

    timers.push(setTimeout(() => {
      Animated.timing(closingOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 3600));

    timers.push(setTimeout(() => {
      Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 4400));

    return () => timers.forEach(clearTimeout);
  }, [titleOpacity, titleTranslateY, morningOpacity, morningTranslateY, eveningOpacity, eveningTranslateY, focusOpacity, confidenceOpacity, positionOpacity, closingOpacity, buttonOpacity]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer>
        <ProgressIndicator current={11} total={17} />

        <View style={styles.body}>
          <Animated.Text
            style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }]}
          >
            Now picture 90 days of that structure.
          </Animated.Text>

          <Animated.View style={{ opacity: morningOpacity, transform: [{ translateY: morningTranslateY }] }}>
            <Text style={styles.bodyText}>
              You wake up clear.{'\n'}You know exactly what matters.{'\n'}You act before distractions take control.
            </Text>
          </Animated.View>

          <Animated.View style={{ opacity: eveningOpacity, transform: [{ translateY: eveningTranslateY }] }}>
            <Text style={styles.bodyText}>
              You finish the day aware — not reactive.{'\n'}You adjust. You refine. You improve.
            </Text>
          </Animated.View>

          <View style={styles.triplet}>
            <Animated.Text style={[styles.accent, { opacity: focusOpacity }]}>
              Your focus sharpens.
            </Animated.Text>
            <Animated.Text style={[styles.accent, { opacity: confidenceOpacity }]}>
              Your confidence grows.
            </Animated.Text>
            <Animated.Text style={[styles.accent, { opacity: positionOpacity }]}>
              Your position rises.
            </Animated.Text>
          </View>

          <Animated.View style={{ opacity: closingOpacity }}>
            <Text style={styles.closing}>Not from motivation.</Text>
            <Text style={styles.closingBold}>From consistency.</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
                navigation.navigate('ScreenTimePreFrame');
              });
            }}
            activeOpacity={0.7}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Continue →</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 4 },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 32,
    color: Colors.primary,
    marginBottom: 22,
  },
  bodyText: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  triplet: { marginBottom: 20 },
  accent: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.primary,
  },
  closing: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
    opacity: 0.8,
    marginBottom: 6,
  },
  closingBold: {
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    letterSpacing: -0.3,
    lineHeight: 24,
    color: Colors.primary,
  },
  buttonWrap: { paddingBottom: 32, alignItems: 'flex-end' },
  ctaButton: { paddingVertical: 12, paddingHorizontal: 8 },
  ctaText: { fontFamily: FontFamily.bodyMedium, fontSize: 17, color: Colors.textSecondary },
});

export default NinetyDayVisionScreen;
