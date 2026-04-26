import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import ScreenContainer from '../../../design/components/ScreenContainer';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

export interface BenefitTemplateProps {
  /** Step number (kept on the API for callers — currently unused since the
   *  progress bar is mounted at the navigator level. */
  step: number;
  /** Headline (renders InterTight ExtraBold 28px). */
  headline: string;
  /** Color of the headline (per benefit theme). */
  headlineColor: string;
  /** Body paragraph below the graphic. */
  body: string;
  /** Optional small callout below body (e.g. "+35 XP per session"). */
  callout?: string;
  /** Color for the callout text (defaults to Colors.accent). */
  calloutColor?: string;
  /** Mockup graphic rendered above the headline. */
  graphic: React.ReactNode;
  /** Continue handler. */
  onContinue: () => void;
}

/**
 * Shared layout for benefit screens 10–14: graphic mockup at top,
 * themed headline, body copy, optional callout, then "Continue" CTA.
 */
const BenefitTemplate: React.FC<BenefitTemplateProps> = ({
  step,
  headline,
  headlineColor,
  body,
  callout,
  calloutColor = Colors.accent,
  graphic,
  onContinue,
}) => {
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const graphicOpacity = useRef(new Animated.Value(0)).current;
  const graphicTranslate = useRef(new Animated.Value(20)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(20)).current;
  const advancingRef = useRef(false);

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    Animated.parallel([
      Animated.timing(graphicOpacity, {
        toValue: 1,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(graphicTranslate, {
        toValue: 0,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
    Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 600,
        delay: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(textTranslate, {
        toValue: 0,
        duration: 600,
        delay: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [screenOpacity, graphicOpacity, graphicTranslate, textOpacity, textTranslate]);

  const handleContinue = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => onContinue());
  };

  return (
    <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
      <ScreenContainer centered={false}>
        <View style={styles.body}>
          <View style={styles.graphicSlot}>
            <Animated.View
              style={[
                styles.graphicWrap,
                {
                  opacity: graphicOpacity,
                  transform: [{ translateY: graphicTranslate }],
                },
              ]}
            >
              {graphic}
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.textBlock,
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslate }],
              },
            ]}
          >
            <Text style={[styles.headline, { color: headlineColor }]}>
              {headline}
            </Text>
            <Text style={styles.bodyText}>{body}</Text>
            {callout ? (
              <Text style={[styles.callout, { color: calloutColor }]}>
                {callout}
              </Text>
            ) : null}
          </Animated.View>
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
    justifyContent: 'center',
    paddingTop: 24,
  },
  graphicSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  graphicWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  textBlock: {
    paddingTop: 24,
    paddingBottom: 12,
  },
  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    letterSpacing: -0.3,
    lineHeight: 32,
    textAlign: 'center',
  },
  bodyText: {
    marginTop: 16,
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  callout: {
    marginTop: 16,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  footer: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  cta: {
    backgroundColor: 'rgba(58,102,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(120,160,255,0.55)',
    borderRadius: 28,
    paddingVertical: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A66FF',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: -0.1,
    color: Colors.textPrimary,
  },
});

export default BenefitTemplate;
