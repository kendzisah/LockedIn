/**
 * WakeUpCallScreen — onboarding step 3.
 * Shock stat: convert the user's phone-time answer into "years of your
 * life lost." Mirrors Opal's Focus Report — the most-screenshotted moment
 * in their funnel.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import type { OnboardingStackParamList } from '../../../types/navigation';
import { useOnboarding } from '../state/OnboardingProvider';
import ScreenContainer from '../../../design/components/ScreenContainer';
import HUDPanel from '../../home/components/HUDPanel';
import HUDSectionLabel from '../components/HUDSectionLabel';
import CountUpNumber from '../components/CountUpNumber';
import PrimaryButton from '../../../design/components/PrimaryButton';
import { useOnboardingTracking } from '../hooks/useOnboardingTracking';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'WakeUpCall'>;

/** Default daily phone hours when the user picked "I don't know." */
const FALLBACK_HOURS = 4.5;
/** Default remaining-life window before the AgeQuiz screen runs. */
const DEFAULT_REMAINING_YEARS = 50;
/** Share of phone time the system claims it can give back. */
const RECLAIM_PCT = 0.8;

/**
 * Map the persisted phone-usage value to the midpoint of its band so the
 * years-lost calculation matches the spec table (2–3h → 5.2y, 4–5h →
 * 9.4y, 6–7h → 13.5y, 8+h → 17.7y).
 */
function parseHours(value: string | null): number {
  if (!value || value === 'unknown') return FALLBACK_HOURS;
  const match = value.match(/^(\d+)/);
  if (!match) return FALLBACK_HOURS;
  const n = parseInt(match[1], 10);
  if (n <= 3) return 2.5;
  if (n <= 5) return 4.5;
  if (n <= 7) return 6.5;
  return 8.5;
}

function calcYears(hours: number, age: number | null): number {
  // Time-budget model: hours/day × remaining years ÷ 24 (hours/day).
  const remaining = age ? Math.max(20, 80 - age) : DEFAULT_REMAINING_YEARS;
  return (hours * remaining) / 24;
}

const WakeUpCallScreen: React.FC<Props> = ({ navigation }) => {
  useOnboardingTracking('WakeUpCall');

  const { state } = useOnboarding();
  const hours = parseHours(state.phoneUsageHours);
  const yearsExact = calcYears(hours, state.userAge);
  const yearsRounded = Math.round(yearsExact);
  const days = Math.round(yearsExact * 365);

  // 80% reclaim model: of the phone hours, the system can give back the
  // majority. Used to drive the second panel.
  const hoursReclaimed = +(hours * RECLAIM_PCT).toFixed(1);
  const hoursRemaining = +(hours * (1 - RECLAIM_PCT)).toFixed(1);
  // Annualised hours-back expressed as full 24h days.
  const reclaimDaysPerYear = Math.round((hoursReclaimed * 365) / 24);

  const screenOpacity = useRef(new Animated.Value(0)).current;
  const lifeBarFill = useRef(new Animated.Value(0)).current;
  const lifeBarPulse = useRef(new Animated.Value(1)).current;
  const advancingRef = useRef(false);

  // Phone-time fraction of "discretionary" daily hours (~10h = waking hours
  // minus work + life logistics). A tighter denominator than waking-hours
  // so the visual feels closer to what the user actually controls.
  const phoneFraction = Math.min(0.95, hours / 10);

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Bar loads in alongside the year count-up, then settles into a
    // gentle pulse on the red segment.
    Animated.timing(lifeBarFill, {
      toValue: phoneFraction,
      duration: 1600,
      delay: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      // JS driver here so it can co-exist on the same view as the
      // width/left interpolation (native driver doesn't support layout
      // properties — mixing drivers on one view is a runtime error).
      Animated.loop(
        Animated.sequence([
          Animated.timing(lifeBarPulse, {
            toValue: 0.7,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(lifeBarPulse, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      ).start();
    });
  }, [screenOpacity, lifeBarFill, lifeBarPulse, phoneFraction]);

  const handleContinue = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => navigation.navigate('AgeQuiz'));
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <HUDSectionLabel label="SYSTEM ALERT" accentColor={SystemTokens.red} />

          <Text style={styles.title}>HERE'S WHAT THAT COSTS YOU</Text>

          <HUDPanel
            headerLabel="TIME LOST"
            accentColor={SystemTokens.red}
            style={styles.panel}
          >
            <View style={styles.numberWrap}>
              <CountUpNumber
                value={yearsRounded}
                duration={1400}
                startDelay={200}
                style={styles.bigNumber}
              />
              <Text style={styles.bigUnit}>YEARS</Text>
            </View>
            <Text style={styles.subline}>
              of your life will be spent staring at your phone
            </Text>
            <Text style={styles.daysLine}>
              That's <Text style={styles.daysHighlight}>{days.toLocaleString()}</Text> full days. Gone. On nothing.
            </Text>

            <View style={styles.lifeBarWrap}>
              <View style={styles.lifeBar}>
                <Animated.View
                  style={[
                    styles.lifeBarPhone,
                    {
                      width: lifeBarFill.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                      opacity: lifeBarPulse,
                    },
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.lifeBarTip,
                    {
                      left: lifeBarFill.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                      opacity: lifeBarPulse,
                    },
                  ]}
                />
              </View>
              <View style={styles.lifeBarLabels}>
                <Text style={styles.lifeBarLabelRed}>PHONE</Text>
                <Text style={styles.lifeBarLabelMuted}>EVERYTHING ELSE</Text>
              </View>
            </View>
          </HUDPanel>

          <Text style={styles.flipEyebrow}>BUT HERE'S THE FLIP</Text>
          <Text style={styles.flipTitle}>You can reclaim 80%.</Text>

          <HUDPanel
            headerLabel="TIME RECLAIMED"
            accentColor={SystemTokens.green}
            style={styles.panel}
          >
            <View style={styles.numberWrap}>
              <Text style={styles.reclaimNumber}>
                {hoursReclaimed}
                <Text style={styles.reclaimUnit}> hrs/day</Text>
              </Text>
              <Text style={styles.reclaimLabel}>back in your hands</Text>
            </View>

            <View style={styles.compareRow}>
              <View style={styles.compareCol}>
                <Text style={styles.compareValueRed}>{hours} hrs</Text>
                <View style={styles.compareBarTrack}>
                  <View style={[styles.compareBarFill, styles.compareBarRed]} />
                </View>
                <Text style={styles.compareLabelMuted}>WITHOUT</Text>
              </View>

              <View style={styles.compareCol}>
                <Text style={styles.compareValueGreen}>{hoursRemaining} hrs</Text>
                <View style={styles.compareBarTrack}>
                  <View
                    style={[
                      styles.compareBarFill,
                      styles.compareBarGreen,
                      { height: `${(hoursRemaining / hours) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.compareLabelGreen}>WITH</Text>
              </View>
            </View>

            <Text style={styles.reclaimFootnote}>
              That's about{' '}
              <Text style={styles.reclaimFootnoteAccent}>
                {reclaimDaysPerYear} extra days
              </Text>{' '}
              a year — back on what actually moves you forward.
            </Text>
          </HUDPanel>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title="> I'M READY TO CHANGE"
            onPress={handleContinue}
            style={styles.cta}
          />
        </View>
      </ScreenContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 32,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: SystemTokens.red,
    marginBottom: 18,
    textShadowColor: SystemTokens.red,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  panel: {
    marginBottom: 16,
  },
  numberWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  bigNumber: {
    fontFamily: FontFamily.headingBold,
    fontSize: 64,
    lineHeight: 72,
    color: SystemTokens.red,
    letterSpacing: -1,
    textShadowColor: SystemTokens.red,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  bigUnit: {
    fontFamily: FontFamily.headingBold,
    fontSize: 14,
    letterSpacing: 4,
    color: SystemTokens.red,
    marginTop: -4,
  },
  subline: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: SystemTokens.textMuted,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
  },
  daysLine: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  daysHighlight: {
    color: SystemTokens.red,
    fontFamily: FontFamily.headingBold,
  },
  lifeBarWrap: {
    marginTop: 22,
  },
  lifeBar: {
    height: 18,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  lifeBarPhone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: SystemTokens.red,
    shadowColor: SystemTokens.red,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  lifeBarTip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    marginLeft: -3,
    backgroundColor: '#FFFFFF',
    shadowColor: SystemTokens.red,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  lifeBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  lifeBarLabelRed: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: SystemTokens.red,
  },
  lifeBarLabelMuted: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: SystemTokens.textMuted,
  },
  flipEyebrow: {
    marginTop: 12,
    fontFamily: FontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: SystemTokens.green,
  },
  flipTitle: {
    marginTop: 6,
    marginBottom: 14,
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: SystemTokens.green,
    textShadowColor: SystemTokens.green,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  reclaimNumber: {
    fontFamily: FontFamily.headingBold,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1,
    color: SystemTokens.green,
    textAlign: 'center',
    textShadowColor: SystemTokens.green,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  reclaimUnit: {
    fontSize: 18,
    letterSpacing: 0,
    color: SystemTokens.green,
  },
  reclaimLabel: {
    marginTop: 4,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: SystemTokens.textMuted,
    textAlign: 'center',
  },
  compareRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 24,
  },
  compareCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  compareValueRed: {
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    color: SystemTokens.red,
  },
  compareValueGreen: {
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    color: SystemTokens.green,
  },
  compareBarTrack: {
    width: 28,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 2,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  compareBarFill: {
    width: '100%',
    height: '100%',
  },
  compareBarRed: {
    backgroundColor: SystemTokens.red,
    opacity: 0.85,
  },
  compareBarGreen: {
    backgroundColor: SystemTokens.green,
    opacity: 0.85,
  },
  compareLabelMuted: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: SystemTokens.textMuted,
  },
  compareLabelGreen: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: SystemTokens.green,
  },
  reclaimFootnote: {
    marginTop: 16,
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  reclaimFootnoteAccent: {
    color: SystemTokens.green,
    fontFamily: FontFamily.headingBold,
  },
  footer: {
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: Colors.background,
  },
  cta: {
    width: '100%',
  },
});

export default WakeUpCallScreen;
