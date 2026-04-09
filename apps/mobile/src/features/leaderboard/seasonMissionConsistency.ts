import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentSeasonId, SEASON_LENGTH_DAYS } from './seasonDiscipline';

const STORAGE_KEY = '@lockedin/season_perfect_mission_days';

export interface SeasonMissionStore {
  seasonId: string;
  /** Local date keys (YYYY-MM-DD) where user hit daily + weekly mission bar. */
  perfectDays: string[];
}

async function load(): Promise<SeasonMissionStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { seasonId: getCurrentSeasonId(), perfectDays: [] };
    const p = JSON.parse(raw) as Partial<SeasonMissionStore>;
    const seasonId = typeof p.seasonId === 'string' ? p.seasonId : getCurrentSeasonId();
    const perfectDays = Array.isArray(p.perfectDays)
      ? p.perfectDays.filter((d): d is string => typeof d === 'string')
      : [];
    return { seasonId, perfectDays };
  } catch {
    return { seasonId: getCurrentSeasonId(), perfectDays: [] };
  }
}

async function save(data: SeasonMissionStore): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Clear when season id changes (new 90-day period). */
export async function ensureSeasonStoreCurrent(): Promise<SeasonMissionStore> {
  const current = getCurrentSeasonId();
  const data = await load();
  if (data.seasonId !== current) {
    const next: SeasonMissionStore = { seasonId: current, perfectDays: [] };
    await save(next);
    return next;
  }
  return data;
}

/**
 * Record one calendar day as "perfect" for mission consistency: all daily missions done
 * and every active weekly challenge completed (or none assigned yet).
 */
export async function recordPerfectMissionDay(dateKey: string): Promise<void> {
  const data = await ensureSeasonStoreCurrent();
  if (data.perfectDays.includes(dateKey)) return;
  data.perfectDays.push(dateKey);
  data.perfectDays.sort();
  await save(data);
}

/**
 * Ratio of perfect mission days to season length (90), capped by how much of the season has passed.
 * Used for Locked In eligibility: must be >= LOCKED_IN_MIN_CONSISTENCY (0.9).
 */
export async function getSeasonMissionConsistencyRatio(): Promise<number> {
  const data = await ensureSeasonStoreCurrent();
  const perfect = data.perfectDays.length;
  return Math.min(1, perfect / SEASON_LENGTH_DAYS);
}

const MIN_PERFECT_DAYS = Math.ceil(0.9 * SEASON_LENGTH_DAYS); // 81 of 90 days

/** Whether the user qualifies for the top "Locked In" tier (≥90% perfect mission days this season). */
export async function isLockedInMissionEligible(): Promise<boolean> {
  const data = await ensureSeasonStoreCurrent();
  return data.perfectDays.length >= MIN_PERFECT_DAYS;
}
