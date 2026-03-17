import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { MixpanelService } from '../../../services/MixpanelService';
import ScreenContainer from '../../../design/components/ScreenContainer';
import ProgressIndicator from '../../../design/components/ProgressIndicator';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const BULLETS = [
  'Your phone goes silent',
  'Distractions are blocked',
  'You complete a structured session',
  'You train self-command under pressure',
];

const BULLET_STAGGER = 150;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ProductExplainer'>;

const ProductExplainerScreen: React.FC<Props> = ({ navigation }) => {
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(20)).current;
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const subtextTranslateY = useRef(new Animated.Value(20)).current;

  const bulletAnims = useRef(
    BULLETS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(20),
    })),
  ).current;

  const lottieRefs = useRef<(LottieView | null)[]>(BULLETS.map(() => null)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    MixpanelService.track('Onboarding Screen Viewed', { screen: 'ProductExplainer', step: 14, total_steps: 18 });
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Header
    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headerTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 300));

    // Subtext
    timers.push(setTimeout(() => {
      Animated.parallel([
        Animated.timing(subtextOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(subtextTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 800));

    // Bullets with checkmarks
    BULLETS.forEach((_, i) => {
      const delay = 1400 + i * BULLET_STAGGER;
      timers.push(setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.parallel([
          Animated.timing(bulletAnims[i].opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(bulletAnims[i].translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(() => {
          lottieRefs[i]?.play();
        });
      }, delay));
    });

    // CTA
    const buttonDelay = 1400 + BULLETS.length * BULLET_STAGGER + 400;
    timers.push(setTimeout(() => {
      Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, buttonDelay));

    return () => timers.forEach(clearTimeout);
  }, [headerOpacity, headerTranslateY, subtextOpacity, subtextTranslateY, bulletAnims, buttonOpacity]);

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer>
        <ProgressIndicator current={13} total={17} />

        <View style={styles.body}>
          <Animated.Text
            style={[styles.title, { opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] }]}
          >
            This isn't motivation.
          </Animated.Text>

          <Animated.Text
            style={[styles.subtext, { opacity: subtextOpacity, transform: [{ translateY: subtextTranslateY }] }]}
          >
            This is a daily conditioning protocol.
          </Animated.Text>

          <View style={styles.bullets}>
            {BULLETS.map((item, i) => (
              <Animated.View
                key={item}
                style={[
                  styles.bulletRow,
                  { opacity: bulletAnims[i].opacity, transform: [{ translateY: bulletAnims[i].translateY }] },
                ]}
              >
                <View style={styles.checkWrap}>
                  <LottieView
                    ref={(ref) => { lottieRefs[i] = ref; }}
                    source={require('../../../../assets/lottie/checkmark-draw.json')}
                    style={styles.checkLottie}
                    loop={false}
                    autoPlay={false}
                  />
                </View>
                <Text style={styles.bulletText}>{item}</Text>
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
                navigation.navigate('NotificationPreFrame');
              });
            }}
            activeOpacity={0.85}
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
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 36,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtext: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
    marginBottom: 28,
  },
  bullets: {
    gap: 14,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkWrap: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  checkLottie: {
    width: 24,
    height: 24,
  },
  bulletText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.textSecondary,
    letterSpacing: -0.1,
    flex: 1,
  },
  buttonWrap: {
    paddingBottom: 32,
    alignItems: 'center',
  },
  ctaButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  ctaText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 17,
    color: Colors.textSecondary,
  },
});

export default ProductExplainerScreen;
