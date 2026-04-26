/**
 * systemTokens — Centralized HUD design tokens for the home/session
 * surfaces. Every panel reads from here so the entire system shares one
 * visual language.
 */

import type { TextStyle } from 'react-native';
import type { Stat } from '@lockedin/shared-types';
import { FontFamily } from '../../design/typography';

export const SystemTokens = {
  panelBg: 'rgba(10,22,40,0.85)',
  panelBorder: 'rgba(58,102,255,0.12)',
  panelRadius: 4,
  bracketColor: 'rgba(58,102,255,0.6)',
  divider: 'rgba(255,255,255,0.06)',
  barTrack: 'rgba(255,255,255,0.06)',
  glowAccent: '#3A66FF',
  glowAccentSoft: 'rgba(58,102,255,0.06)',
  cyan: '#00C2FF',
  green: '#00D68F',
  gold: '#FFC857',
  purple: '#A855F7',
  red: '#FF4757',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textGlow: 'rgba(58,102,255,0.4)',
} as const;

export const STAT_COLORS: Record<Stat, string> = {
  discipline:  '#3A66FF',
  focus:       '#00C2FF',
  execution:   '#00D68F',
  consistency: '#FFC857',
  social:      '#A855F7',
};

export const STAT_LABELS: Record<Stat, string> = {
  discipline:  'DIS',
  focus:       'FOC',
  execution:   'EXE',
  consistency: 'CON',
  social:      'SOC',
};

export const SectionLabelStyle: TextStyle = {
  fontFamily: FontFamily.headingBold,
  fontSize: 11,
  letterSpacing: 2.5,
  color: SystemTokens.glowAccent,
};

export const SectionMetaStyle: TextStyle = {
  fontFamily: FontFamily.headingSemiBold,
  fontSize: 11,
  letterSpacing: 1,
  color: SystemTokens.textMuted,
};

let _hasBooted = false;
export const getHasBooted = (): boolean => _hasBooted;
export const markBooted = (): void => {
  _hasBooted = true;
};
