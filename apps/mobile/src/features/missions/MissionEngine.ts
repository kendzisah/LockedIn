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

import type { Stat } from '@lockedin/shared-types';

/**
 * Map mission type → primary stat(s) it grows. Used to render the
 * +STAT pill on each mission card AND to drive StatsService bumps when
 * a mission is completed. Order matters when 2 stats — the first is
 * the primary tag.
 */
export const MISSION_TYPE_STATS: Record<MissionType, Stat[]> = {
  focus_session: ['focus', 'execution'],
  workout_check: ['discipline', 'consistency'],
  reflection:    ['discipline'],
  no_social:     ['focus', 'discipline'],
  journal:       ['discipline', 'consistency'],
  reading:       ['focus'],
  planning:      ['execution'],
  discipline:    ['discipline'],
  lifestyle:     ['consistency'],
  social:        ['social'],
  custom:        ['execution'],
};

export type CompletionType = 'auto' | 'self-report' | 'hybrid';
export type DifficultyTier = 'easy' | 'medium' | 'hard';
export type MissionSlot = 'core' | 'goal' | 'weakness';
export type MissionDuration = 'daily' | 'weekly';
export type ProgressMetric = 'days_active' | 'days_streak' | 'first_open_before_9am';

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  completed: boolean;
  failed?: boolean;
  xp: number;
  slot: MissionSlot;
  completionType: CompletionType;
  difficulty: DifficultyTier;
  timeGate?: string;
  duration: MissionDuration;
  progress?: number;
  progressTarget?: number;
  progressMetric?: ProgressMetric;
  /** Stats this mission grows when completed. Defaults from MISSION_TYPE_STATS. */
  stats?: Stat[];
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
    duration: template.duration ?? 'daily',
    progress: template.duration === 'weekly' ? 0 : undefined,
    progressTarget: template.progressTarget,
    progressMetric: template.progressMetric,
    stats: MISSION_TYPE_STATS[template.type],
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
      for (let attempt = 1; attempt < weaknessPool.length; attempt++) {
        const nextIndex = (weaknessIndex + attempt) % weaknessPool.length;
        const candidate = buildMission(weaknessPool[nextIndex], 'weakness', tier, streak, dayOfYear, 2);
        if (candidate.title !== goalMission.title) {
          weaknessMission = candidate;
          break;
        }
      }
    }
  }

  return [coreMission, goalMission, weaknessMission];
};

/**
 * Days remaining in the current ISO week (Mon=1 .. Sun=7).
 * Sunday returns 0 (last day), Monday returns 6, etc.
 */
export const getRemainingDaysInWeek = (date: Date = new Date()): number => {
  const day = date.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const isoDay = day === 0 ? 7 : day; // Mon=1 ... Sun=7
  return 7 - isoDay;
};

// ─── Weekly mission generation ─────────────────────────

/** Max concurrent weekly challenge rows (missed + replacement still fits in 2). */
export const MAX_WEEKLY_CHALLENGES = 2;

/** Weekly XP is scaled above typical dailies (~15–35 XP) after streak bonus. */
export const WEEKLY_XP_MULTIPLIER = 2;

export const applyWeeklyXpPremium = (xp: number): number =>
  Math.max(1, Math.round(xp * WEEKLY_XP_MULTIPLIER));

/** ISO week key (YYYY-Www) for the device's local date. */
export const getMissionWeekKey = (date: Date = new Date()): string => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const isoYear = d.getFullYear();
  const yearStart = new Date(isoYear, 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
};

/**
 * Collect weekly mission templates from the user's active pools (unique titles).
 */
export const buildWeeklyTemplatePool = (
  params: MissionGenerationParams,
): { template: MissionTemplate; slot: MissionSlot }[] => {
  const { goal, weaknesses } = params;
  const weeklyTemplates: { template: MissionTemplate; slot: MissionSlot }[] = [];
  const seenTitles = new Set<string>();

  const addUnique = (t: MissionTemplate, slot: MissionSlot) => {
    if (t.duration === 'weekly' && !seenTitles.has(t.title)) {
      seenTitles.add(t.title);
      weeklyTemplates.push({ template: t, slot });
    }
  };

  const validWeaknesses = weaknesses.filter((w) => WEAKNESS_MISSIONS[w]);
  for (const wk of validWeaknesses) {
    for (const t of WEAKNESS_MISSIONS[wk]) addUnique(t, 'weakness');
  }
  if (validWeaknesses.length === 0) {
    for (const t of WEAKNESS_MISSIONS['I lack daily consistency'] ?? []) addUnique(t, 'weakness');
  }

  const goalPool = GOAL_MISSIONS[goal] ?? GOAL_MISSIONS['Increase discipline & self-control'];
  for (const t of goalPool) addUnique(t, 'goal');

  return weeklyTemplates;
};

/**
 * Dedupe titles, prefer failed rows first, cap at MAX_WEEKLY_CHALLENGES (fixes legacy storage with 3+ rows).
 */
export const normalizeWeeklyMissions = (missions: Mission[]): Mission[] => {
  const weeklyOnly = missions.filter((m) => m.duration === 'weekly');
  const seen = new Set<string>();
  const deduped: Mission[] = [];
  for (const m of weeklyOnly) {
    if (seen.has(m.title)) continue;
    seen.add(m.title);
    deduped.push(m);
  }
  const sorted = [...deduped].sort((a, b) => {
    if (!!a.failed !== !!b.failed) return a.failed ? -1 : 1;
    if (!!a.completed !== !!b.completed) return a.completed ? 1 : -1;
    return 0;
  });
  return sorted.slice(0, MAX_WEEKLY_CHALLENGES);
};

/**
 * Next weekly challenge after the primary pick, excluding titles already on screen.
 */
export const generateWeeklyReplacementMission = (
  params: MissionGenerationParams,
  excludeTitles: string[],
  date: Date = new Date(),
): Mission | null => {
  const pool = buildWeeklyTemplatePool(params);
  if (pool.length === 0) return null;

  const excluded = new Set(excludeTitles);
  const weekKey = getMissionWeekKey(date);
  const weekNumber = parseInt(weekKey.replace(/\D/g, ''), 10) || 0;
  const { onboardingDate, streak = 0 } = params;
  const dayOfYear = getDayOfYear(date);
  const daysSinceOnboarding = onboardingDate
    ? Math.max(0, Math.floor((date.getTime() - new Date(onboardingDate).getTime()) / 86_400_000))
    : 0;
  const tier = getDifficultyTier(daysSinceOnboarding);

  for (let offset = 1; offset <= pool.length; offset++) {
    const idx = (weekNumber + offset) % pool.length;
    const picked = pool[idx];
    if (excluded.has(picked.template.title)) continue;
    const m = buildMission(picked.template, picked.slot, tier, streak, dayOfYear, 100);
    return {
      ...m,
      id: `weekly_${weekKey}_${hashStr(picked.template.title)}_r${offset}`,
      progress: 0,
      xp: applyWeeklyXpPremium(m.xp),
    };
  }
  return null;
};

/**
 * Collect all weekly mission templates from the user's active pools.
 * Returns only templates with duration: 'weekly'.
 */
export const generateWeeklyMissions = (params: MissionGenerationParams): Mission[] => {
  const { date = new Date(), onboardingDate, streak = 0 } = params;
  const dayOfYear = getDayOfYear(date);
  const daysSinceOnboarding = onboardingDate
    ? Math.max(0, Math.floor((date.getTime() - new Date(onboardingDate).getTime()) / 86_400_000))
    : 0;
  const tier = getDifficultyTier(daysSinceOnboarding);
  const weekKey = getMissionWeekKey(date);

  const weeklyTemplates = buildWeeklyTemplatePool(params);

  if (weeklyTemplates.length === 0) return [];

  // Pick one weekly mission per week, rotating through available templates
  const weekNumber = parseInt(weekKey.replace(/\D/g, ''), 10) || 0;
  const picked = weeklyTemplates[weekNumber % weeklyTemplates.length];
  const m = buildMission(picked.template, picked.slot, tier, streak, dayOfYear, 100);
  return [
    {
      ...m,
      id: `weekly_${weekKey}_${hashStr(picked.template.title)}_0`,
      progress: 0,
      xp: applyWeeklyXpPremium(m.xp),
    },
  ];
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

const STAT_ORDER: Stat[] = ['discipline', 'focus', 'execution', 'consistency', 'social'];

/**
 * Aggregate the stats actually bumped when a mission from this pool
 * completes. Mirrors the bump logic in MissionsProvider:
 *   - every completion bumps total_missions_completed → Execution
 *   - 'discipline'-tagged missions bump total_distractions_resisted → Discipline
 *   - 'social'-tagged missions bump guild_check_ins → Social
 * Focus and Consistency grow from session minutes / perfect days, not
 * from a single mission completion, so they're intentionally excluded.
 */
const aggregateStats = (templates: MissionTemplate[] | undefined): Stat[] => {
  if (!templates || templates.length === 0) return [];
  const set = new Set<Stat>();
  set.add('execution');
  for (const t of templates) {
    const tags = MISSION_TYPE_STATS[t.type] ?? [];
    if (tags.includes('discipline')) set.add('discipline');
    if (tags.includes('social')) set.add('social');
  }
  return STAT_ORDER.filter((s) => set.has(s));
};

/** Stats that completing a goal's mission pool tends to boost. */
export const getStatsForGoal = (goal: string): Stat[] =>
  aggregateStats(GOAL_MISSIONS[goal]);

/** Stats that completing a weakness's mission pool tends to boost. */
export const getStatsForWeakness = (weakness: string): Stat[] =>
  aggregateStats(WEAKNESS_MISSIONS[weakness]);
