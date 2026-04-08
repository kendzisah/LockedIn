/**
 * Streak tier system — color progression based on consecutive streak days.
 *
 * Tiers: 3d → 7d → 1mo → 3mo → 6mo → 12mo → rotating
 * Each tier intensifies the bar and flame color.
 */

export interface StreakTier {
  threshold: number;
  label: string;
  color: string;
  colorLight: string;
}

export const STREAK_TIERS: StreakTier[] = [
  { threshold: 3,   label: '3 Day',    color: '#FF6B35', colorLight: '#FF8F5E' },
  { threshold: 7,   label: '7 Day',    color: '#FFD700', colorLight: '#FFE44D' },
  { threshold: 30,  label: '1 Month',  color: '#00D68F', colorLight: '#33E5AA' },
  { threshold: 90,  label: '3 Month',  color: '#00C2FF', colorLight: '#5AD8FF' },
  { threshold: 180, label: '6 Month',  color: '#8B5CF6', colorLight: '#A78BFA' },
  { threshold: 365, label: '1 Year',   color: '#FF006E', colorLight: '#FF4D94' },
];

const DEFAULT_COLOR = '#4B5563';
const DEFAULT_COLOR_LIGHT = '#6B7280';

export interface StreakTierInfo {
  current: StreakTier | null;
  next: StreakTier | null;
  progress: number;
  color: string;
  colorLight: string;
}

export function getStreakTierInfo(streak: number): StreakTierInfo {
  if (streak < STREAK_TIERS[0].threshold) {
    return {
      current: null,
      next: STREAK_TIERS[0],
      progress: streak / STREAK_TIERS[0].threshold,
      color: DEFAULT_COLOR,
      colorLight: DEFAULT_COLOR_LIGHT,
    };
  }

  let currentIdx = 0;
  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (streak >= STREAK_TIERS[i].threshold) {
      currentIdx = i;
      break;
    }
  }

  const current = STREAK_TIERS[currentIdx];
  const next = currentIdx < STREAK_TIERS.length - 1 ? STREAK_TIERS[currentIdx + 1] : null;

  if (next) {
    const progress = (streak - current.threshold) / (next.threshold - current.threshold);
    return {
      current,
      next,
      progress: Math.min(1, progress),
      color: current.color,
      colorLight: current.colorLight,
    };
  }

  // Past 365 days: rotate through all tier colors (~60 days each)
  const rotating = getRotatingTier(streak);
  return {
    current: rotating,
    next: null,
    progress: 1,
    color: rotating.color,
    colorLight: rotating.colorLight,
  };
}

function getRotatingTier(streak: number): StreakTier {
  const daysAfterYear = streak - 365;
  const cycleDays = Math.floor(365 / STREAK_TIERS.length); // ~60 days per color
  const tierIndex = Math.floor(daysAfterYear / cycleDays) % STREAK_TIERS.length;
  return STREAK_TIERS[tierIndex];
}

/**
 * Build Lottie colorFilters for the fire animation using the tier color.
 */
export function getFlameColorFilters(color: string, colorLight: string) {
  return [
    { keypath: 'Ebene 1/VG_Flame_Def Konturen', color },
    { keypath: 'Ebene 2/VG_Flame_Def Konturen', color: colorLight },
    { keypath: 'Ebene 3/VG_Flame_Def Konturen', color },
    { keypath: 'Ebene 4/VG_Flame_Def Konturen', color: colorLight },
    { keypath: 'Ebene 5/VG_Flame_Def Konturen', color },
    { keypath: 'Ebene 6/VG_Flame_Def Konturen', color: colorLight },
    { keypath: 'Ebene 7/VG_Flame_Def Konturen', color },
    { keypath: 'Ebene 8/VG_Flame_Def Konturen', color: colorLight },
    { keypath: 'Ebene 9/VG_Flame_Def Konturen', color },
    { keypath: 'Ebene 10/VG_Flame_Def Konturen', color: colorLight },
  ];
}
