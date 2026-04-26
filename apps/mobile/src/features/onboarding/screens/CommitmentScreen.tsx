import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Analytics } from '../../../services/AnalyticsService';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Commitment'>;

interface Block {
  delay: number;
  lines: { text: string; color: string; bold?: boolean }[];
}

const BLOCKS: Block[] = [
  {
    delay: 0,
    lines: [
      { text: 'Right now, someone your age',          color: Colors.textPrimary, bold: true },
      { text: 'is putting in the work you keep',      color: Colors.textPrimary, bold: true },
      { text: 'putting off.',                          color: Colors.danger,      bold: true },
    ],
  },
  {
    delay: 2000,
    lines: [
      { text: "They're locking in while",   color: Colors.textSecondary },
      { text: "you're still deciding.",     color: Colors.textSecondary },
    ],
  },
  {
    delay: 3500,
    lines: [
      { text: 'Every day you skip,',        color: Colors.textPrimary },
      { text: 'they pull further ahead.',   color: Colors.danger },
    ],
  },
  {
    delay: 5000,
    lines: [
      { text: "Greatness isn't a talent.", color: Colors.accent, bold: true },
      { text: "It's a decision.",          color: Colors.accent, bold: true },
    ],
  },
  {
    delay: 6000,
    lines: [
      { text: '[ SYSTEM READY ]',                  color: Colors.accent,         bold: true },
      { text: 'Awaiting Player input...',           color: Colors.textSecondary },
    ],
  },
];

const CTA_DELAY_MS = 7200;

const CommitmentScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('Commitment');

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const blockOpacities = useRef(BLOCKS.map(() => new Animated.Value(0))).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const pulseGlow = useRef(new Animated.Value(0.6)).current;
  const advancingRef = useRef(false);

  useEffect(() => {
    BLOCKS.forEach((block, idx) => {
      Animated.timing(blockOpacities[idx], {
        toValue: 1,
        duration: 700,
        delay: block.delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });

    const ctaTimer = setTimeout(() => {
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseGlow, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(pulseGlow, {
            toValue: 0.6,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      ).start();
    }, CTA_DELAY_MS);

    return () => clearTimeout(ctaTimer);
  }, [blockOpacities, ctaOpacity, pulseGlow]);

  const handleCommit = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Analytics.track('Onboarding Screen Viewed', {
      screen: 'Commitment',
      step: 18,
      committed: true,
    });
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => navigation.navigate('SocialProof'));
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.body}>
          {BLOCKS.map((block, idx) => (
            <Animated.View
              key={idx}
              style={[styles.block, { opacity: blockOpacities[idx] }]}
            >
              {block.lines.map((line, i) => (
                <Text
                  key={i}
                  style={[
                    line.bold ? styles.blockTextBold : styles.blockText,
                    { color: line.color },
                  ]}
                >
                  {line.text}
                </Text>
              ))}
            </Animated.View>
          ))}
        </View>

        <Animated.View style={[styles.footer, { opacity: ctaOpacity }]}>
          <Animated.View
            style={[
              styles.ctaWrap,
              {
                shadowOpacity: pulseGlow,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.cta}
              onPress={handleCommit}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>I'M READY TO WORK</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  body: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    gap: 24,
  },
  block: {
    alignItems: 'center',
  },
  blockTextBold: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    letterSpacing: -0.2,
    lineHeight: 28,
    textAlign: 'center',
  },
  blockText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  ctaWrap: {
    shadowColor: '#3A66FF',
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  cta: {
    backgroundColor: 'rgba(58,102,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(120,160,255,0.55)',
    borderRadius: 28,
    paddingVertical: 18,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    letterSpacing: 0.5,
    color: Colors.textPrimary,
  },
});

export default CommitmentScreen;
