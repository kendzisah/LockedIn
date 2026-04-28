import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import ScreenContainer from '../../../design/components/ScreenContainer';
import PrimaryButton from '../../../design/components/PrimaryButton';
import HUDPanel from '../../home/components/HUDPanel';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';

export interface BenefitTemplateProps {
  /** Step number (kept on the API for callers — currently unused since the
   *  progress bar is mounted at the navigator level. */
  step: number;
  /** Monospace `// LABEL` shown above the graphic panel. */
  panelLabel?: string;
  /** Headline (renders InterTight Bold 26px). */
  headline: string;
  /** Color of the headline (per benefit theme). */
  headlineColor: string;
  /** Body paragraph below the graphic. */
  body: string;
  /** Optional small callout below body (e.g. "+35 XP per session"). */
  callout?: string;
  /** Color for the callout text (defaults to SystemTokens.cyan). */
  calloutColor?: string;
  /** Mockup graphic rendered above the headline. */
  graphic: React.ReactNode;
  /** Continue handler. */
  onContinue: () => void;
}

/**
 * Shared HUD layout for benefit screens 10–14: graphic mockup wrapped
 * in an HUDPanel with corner brackets + `// LABEL` header, themed
 * headline below, body copy, optional callout, then HUD action button.
 */
const BenefitTemplate: React.FC<BenefitTemplateProps> = ({
  panelLabel,
  headline,
  headlineColor,
  body,
  callout,
  calloutColor = SystemTokens.cyan,
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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.graphicSlot,
              {
                opacity: graphicOpacity,
                transform: [{ translateY: graphicTranslate }],
              },
            ]}
          >
            <HUDPanel headerLabel={panelLabel ?? 'SYSTEM'} accentColor={headlineColor}>
              <View style={styles.graphicInner}>{graphic}</View>
            </HUDPanel>
          </Animated.View>

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
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton title="CONTINUE" onPress={handleContinue} style={styles.cta} />
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
    flexGrow: 1,
    // Top-aligned, not centered — when content is tall the footer overlay
    // would otherwise visually clip the bottom of the body paragraph.
    justifyContent: 'flex-start',
    paddingTop: 24,
    // Generous bottom padding so the last line of body never sits under
    // the (translucent) Continue button.
    paddingBottom: 32,
  },
  graphicSlot: {
    width: '100%',
  },
  graphicInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  textBlock: {
    paddingTop: 22,
    paddingBottom: 12,
  },
  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 26,
    letterSpacing: -0.3,
    lineHeight: 30,
    textAlign: 'center',
  },
  bodyText: {
    marginTop: 14,
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  callout: {
    marginTop: 14,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  footer: {
    paddingTop: 12,
    paddingBottom: 8,
    // Opaque so scrolled-past body text never ghosts through the
    // translucent CTA button.
    backgroundColor: Colors.background,
  },
  cta: {
    width: '100%',
  },
});

export default BenefitTemplate;
