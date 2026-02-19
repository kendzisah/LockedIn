import { TextStyle } from 'react-native';

/**
 * Typography presets for the LockedIn app.
 * Keep consistent across all screens.
 */
export const Typography: Record<string, TextStyle> = {
  heading: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  button: {
    fontSize: 18,
    fontWeight: '600',
  },
} as const;
