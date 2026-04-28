import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../../types/navigation';
import ScreenContainer from '../../../design/components/ScreenContainer';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SocialProof'>;

const STAT_CARDS: { value: string; lines: string[] }[] = [
  { value: '12K+', lines: ['USERS', 'LOCKED IN'] },
  { value: '2.4M+', lines: ['FOCUS', 'MINUTES'] },
  { value: '28', lines: ['AVG STREAK', 'DAYS'] },
];

const TESTIMONIALS: { quote: string; author: string }[] = [
  { quote: 'Went from 8 hours screen time to 2. OVR 74.', author: 'Marcus, 19' },
  { quote: 'Day 47. Chosen. Never going back.', author: 'Jayden, 17' },
  { quote: "My guild keeps me accountable. Can't let them down.", author: 'Lance, 22' },
];

const SocialProofScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('SocialProof');

  const screenOpacity = useRef(new Animated.Value(0)).current;
  const advancingRef = useRef(false);

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const handleContinue = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => navigation.navigate('Paywall'));
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>

        <View style={styles.body}>
          <Text style={styles.headline}>
            JOIN THOUSANDS WHO STOPPED TALKING AND STARTED EXECUTING
          </Text>

          <View style={styles.statRow}>
            {STAT_CARDS.map((card) => (
              <View key={card.value} style={styles.statCard}>
                <Text style={styles.statValue}>{card.value}</Text>
                {card.lines.map((line) => (
                  <Text key={line} style={styles.statLine}>
                    {line}
                  </Text>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.testimonials}>
            {TESTIMONIALS.map((t) => (
              <View key={t.author} style={styles.testimonial}>
                <Text style={styles.quote}>"{t.quote}"</Text>
                <Text style={styles.author}>— {t.author}</Text>
              </View>
            ))}
          </View>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Ionicons key={i} name="star" size={16} color={Colors.warning} />
            ))}
            <Text style={styles.starsLabel}>4+ on the App Store</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cta}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 24,
  },
  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    letterSpacing: -0.2,
    lineHeight: 28,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  statRow: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
    color: Colors.textPrimary,
  },
  statLine: {
    marginTop: 2,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.textSecondary,
  },
  testimonials: {
    marginTop: 24,
    gap: 10,
  },
  testimonial: {
    backgroundColor: 'rgba(21,26,33,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
  },
  quote: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  author: {
    marginTop: 6,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  starsRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  starsLabel: {
    marginLeft: 8,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  footer: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  cta: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 28,
    paddingVertical: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: -0.1,
    color: Colors.textPrimary,
  },
});

export default SocialProofScreen;
