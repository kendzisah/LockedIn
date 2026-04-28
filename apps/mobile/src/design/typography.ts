import { TextStyle } from 'react-native';

/**
 * Font family constants.
 * These must match the keys used in useFonts() in App.tsx.
 */
export const FontFamily = {
  /** Inter Tight 800 — major statements, hero text */
  headingBold: 'InterTight_800ExtraBold',
  /** Inter Tight 700 — primary headings */
  heading: 'InterTight_700Bold',
  /** Inter Tight 600 — section headers */
  headingSemiBold: 'InterTight_600SemiBold',
  /** Inter 500 — emphasized body */
  bodyMedium: 'Inter_500Medium',
  /** Inter 400 — default body text */
  body: 'Inter_400Regular',
  /** JetBrains Mono 400 — terminal / system text (e.g. "> SYSTEM INITIALIZING") */
  mono: 'JetBrainsMono_400Regular',
  /** JetBrains Mono 700 — emphasized terminal text */
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/**
 * Typography presets for the LockedIn app.
 *
 * Headline: Inter Tight — modern, slightly compressed, intentional.
 * Body: Inter — extremely readable, neutral, serious.
 */
export const Typography: Record<string, TextStyle> = {
  /** Hero / major statement — Inter Tight 800 */
  hero: {
    fontFamily: FontFamily.headingBold,
    fontSize: 36,
    letterSpacing: -0.5,
    lineHeight: 42,
  },
  /** Primary heading — Inter Tight 700 */
  heading: {
    fontFamily: FontFamily.heading,
    fontSize: 28,
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  /** Section header — Inter Tight 600 */
  sectionHeader: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 22,
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  /** Body text — Inter 400 */
  body: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  },
  /** Emphasized body — Inter 500 */
  bodyMedium: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 24,
  },
  /** Subtext — Inter 400 smaller */
  subtext: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  /** Caption — Inter 400 smallest */
  caption: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 16,
  },
  /** Button label — Inter Tight 600 */
  button: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
    letterSpacing: -0.1,
  },
} as const;
