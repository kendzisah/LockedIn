/**
 * Core color palette for the LockedIn app.
 *
 * Palette: Deep graphite base, Discipline Blue accent, Electric Cyan edge.
 * Feels: Precise. Structured. Technical.
 */
export const Colors = {
  // ─── Backgrounds ───
  /** Primary background — deep graphite */
  background: '#0E1116',
  /** Secondary background — adds depth without full black */
  backgroundSecondary: '#151A21',
  /** Elevated surface / cards / dividers — deep steel */
  surface: '#2C3440',

  // ─── Accent ───
  /** Primary accent — Discipline Blue (buttons, CTAs, active states) */
  primary: '#3A66FF',
  /** Subtle edge accent — Electric Cyan (streaks, Lock In active). Use sparingly. */
  accent: '#00C2FF',

  // ─── Text ───
  /** Primary text — high contrast on dark */
  textPrimary: '#FFFFFF',
  /** Secondary text */
  textSecondary: '#9CA3AF',
  /** Muted text */
  textMuted: '#6B7280',

  // ─── Utility ───
  /** Disabled / inactive elements */
  disabled: '#2C3440',
  /** Success / positive feedback */
  success: '#00D68F',
  /** Danger / destructive actions */
  danger: '#FF4757',
  /** Warning / upgrade prompts */
  warning: '#FFC857',

  // ─── Lock In Active Mode ───
  /** Near-black immersive background when session is running */
  lockInBackground: '#090C10',
} as const;
