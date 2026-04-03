/**
 * MissionEngine.ts
 *
 * 3-slot daily mission selection:
 *   Slot 1 (Core)     — rotates through 10 universal focus-session missions
 *   Slot 2 (Goal)     — pulled from user's primaryGoal pool (15 missions)
 *   Slot 3 (Weakness) — pulled from user's selectedWeaknesses pool (8 each)
 *
 * Difficulty escalates over time: Easy (week 1-2), Medium (week 3-4), Hard (week 5+).
 * Streak ≥ 7 adds a 10 % XP bonus.
 * If Slot 2 and Slot 3 share the same title stem, Slot 3 is re-rolled.
 */

import {
  CORE_MISSIONS,
  GOAL_MISSIONS,
  WEAKNESS_MISSIONS,
  MissionTemplate,
} from './MissionData';

// ─── Public types ───────────────────────────────────────

export type MissionType =
  | 'focus_session'
  | 'workout_check'
  | 'reflection'
  | 'no_social'
  | 'journal'
  | 'reading'
  | 'planning'
  | 'discipline'
  | 'lifestyle'
  | 'social'
  | 'custom';

export type CompletionType = 'auto' | 'self-report' | 'hybrid';
export type DifficultyTier = 'easy' | 'medium' | 'hard';
export type MissionSlot = 'core' | 'goal' | 'weakness';

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  completed: boolean;
  xp: number;
  slot: MissionSlot;
  completionType: CompletionType;
  difficulty: DifficultyTier;
  timeGate?: string;
}

// ─── Helpers ────────────────────────────────────────────

const getDayOfYear = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
};

/** Simple deterministic hash for a string → stable integer. */
const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

/** Difficulty based on days since onboarding completed. */
export const getDifficultyTier = (daysSinceOnboarding: number): DifficultyTier => {
  if (daysSinceOnboarding < 14) return 'easy';
  if (daysSinceOnboarding < 28) return 'medium';
  return 'hard';
};

/** XP with optional streak bonus (10 % for streak ≥ 7). */
const applyStreakBonus = (baseXP: number, streak: number): number =>
  streak >= 7 ? Math.round(baseXP * 1.1) : baseXP;

const buildMission = (
  template: MissionTemplate,
  slot: MissionSlot,
  tier: DifficultyTier,
  streak: number,
  dayOfYear: number,
  index: number,
): Mission => {
  const baseXP = template.xp[tier];
  const desc =
    slot === 'core' && template.variants
      ? `${template.description} — ${template.variants[tier]}`
      : template.description;

  return {
    id: `mission_${dayOfYear}_${index}`,
    title: template.title,
    description: desc,
    type: template.type,
    completed: false,
    xp: applyStreakBonus(baseXP, streak),
    slot,
    completionType: template.completionType,
    difficulty: tier,
    timeGate: template.timeGate,
  };
};

// ─── Selection Logic ────────────────────────────────────

export interface MissionGenerationParams {
  goal: string;
  weaknesses: string[];
  date?: Date;
  /** ISO date string of when onboarding completed (for difficulty tier). */
  onboardingDate?: string;
  /** Current consecutive streak for XP bonus. */
  streak?: number;
}

/**
 * Generate 3 daily missions following the slot system from the mission matrix.
 *
 * Slot 1 (Core):     index = dayOfYear % 10
 * Slot 2 (Goal):     index = hash(dayOfYear + goal) % 15
 * Slot 3 (Weakness): rotate across user weaknesses, then hash picks mission
 */
export const generateDailyMissions = (params: MissionGenerationParams): Mission[] => {
  const {
    goal,
    weaknesses,
    date = new Date(),
    onboardingDate,
    streak = 0,
  } = params;

  const dayOfYear = getDayOfYear(date);

  const daysSinceOnboarding = onboardingDate
    ? Math.max(0, Math.floor((date.getTime() - new Date(onboardingDate).getTime()) / 86_400_000))
    : 0;
  const tier = getDifficultyTier(daysSinceOnboarding);

  // ── Slot 1: Core ──
  const coreIndex = dayOfYear % CORE_MISSIONS.length;
  const coreMission = buildMission(CORE_MISSIONS[coreIndex], 'core', tier, streak, dayOfYear, 0);

  // ── Slot 2: Goal ──
  const goalPool = GOAL_MISSIONS[goal] ?? GOAL_MISSIONS['Increase discipline & self-control'];
  const goalIndex = hashStr(`${dayOfYear}_${goal}`) % goalPool.length;
  const goalMission = buildMission(goalPool[goalIndex], 'goal', tier, streak, dayOfYear, 1);

  // ── Slot 3: Weakness ──
  let weaknessMission: Mission;
  const validWeaknesses = weaknesses.filter((w) => WEAKNESS_MISSIONS[w]);

  if (validWeaknesses.length === 0) {
    // Fallback: pick from default weakness pool
    const fallbackPool = WEAKNESS_MISSIONS['I lack daily consistency'];
    const fallbackIndex = hashStr(`${dayOfYear}_weakness`) % fallbackPool.length;
    weaknessMission = buildMission(fallbackPool[fallbackIndex], 'weakness', tier, streak, dayOfYear, 2);
  } else {
    const weaknessPoolKey = validWeaknesses[dayOfYear % validWeaknesses.length];
    const weaknessPool = WEAKNESS_MISSIONS[weaknessPoolKey];
    let weaknessIndex = hashStr(`${dayOfYear}_${weaknessPoolKey}`) % weaknessPool.length;

    weaknessMission = buildMission(weaknessPool[weaknessIndex], 'weakness', tier, streak, dayOfYear, 2);

    // Dedup: re-roll if title collides with goal mission (e.g. both "No Social Media" variants)
    if (weaknessMission.title === goalMission.title) {
      weaknessIndex = (weaknessIndex + 1) % weaknessPool.length;
      weaknessMission = buildMission(weaknessPool[weaknessIndex], 'weakness', tier, streak, dayOfYear, 2);
    }
  }

  return [coreMission, goalMission, weaknessMission];
};

// ─── Legacy compat wrapper (used by MissionsProvider before migration) ───

export const getMissionsForGoal = (
  goal: string,
  date: Date = new Date(),
): Mission[] =>
  generateDailyMissions({ goal, weaknesses: [], date });

// ─── Utility exports ────────────────────────────────────

export const calculateTotalXP = (missions: Mission[]): number =>
  missions.reduce((sum, m) => sum + m.xp, 0);

export const getCompletedCount = (missions: Mission[]): number =>
  missions.filter((m) => m.completed).length;

export const getPrimaryGoals = (): string[] => Object.keys(GOAL_MISSIONS);

export const getWeaknessOptions = (): string[] => Object.keys(WEAKNESS_MISSIONS);
