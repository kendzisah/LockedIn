/**
 * SessionRepository — Fetches audio tracks for the 90-day program.
 *
 * All sessions are ~5 min. No duration parameter needed.
 *
 * Day-based query:
 *   getTrackForDay(dayNumber, phase) — primary path for program playback
 *   Queries audio_tracks WHERE day_number = X AND category = phase AND is_active = true
 *   Unique partial index guarantees 0 or 1 row.
 *
 * Legacy query:
 *   getSessionFor(date, phase) — still available for future admin-scheduled content
 *
 * Caching:
 *   Keyed by audioTrackId. On cache hit, check if signed URL is still valid
 *   (> 5 min remaining based on cached timestamp + 30-min TTL). If expired, re-sign only.
 *
 * Prefetch: called on Home mount, caches result for instant Session screen load.
 */

import type { ContentPhase } from '@lockedin/shared-types';
import { getSignedAudioUrl } from '@lockedin/supabase-client';
import { SupabaseService } from './SupabaseService';
import { ClockService } from './ClockService';

// ── Constants ──

const SESSION_DURATION_MINUTES = 5;
const SIGNED_URL_TTL_SECONDS = 1800; // 30 min
const SIGNED_URL_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // re-sign if < 5 min remaining

// ── Types ──

export interface TodaySession {
  phase: ContentPhase;
  scheduledDate: string;
  durationMinutes: number;
  durationSeconds: number;
  title: string;
  signedAudioUrl: string;
  audioTrackId: string;
  /** true if using nearest-previous session, not today's exact date */
  isFallback: boolean;
}

export interface DayTrack {
  title: string;
  durationSeconds: number;
  signedAudioUrl: string;
  audioTrackId: string;
  dayNumber: number;
  phase: ContentPhase;
  coreTenet: string | null;
}

export interface OnboardingTrack {
  title: string;
  durationSeconds: number;
  signedAudioUrl: string;
  audioTrackId: string;
}

// ── Day track cache (keyed by audioTrackId) ──

interface DayTrackCacheEntry {
  track: DayTrack;
  signedAt: number; // timestamp when URL was signed
}

const dayTrackCache = new Map<string, DayTrackCacheEntry>();

function isDayTrackCacheValid(entry: DayTrackCacheEntry): boolean {
  const elapsed = Date.now() - entry.signedAt;
  const remaining = SIGNED_URL_TTL_SECONDS * 1000 - elapsed;
  return remaining > SIGNED_URL_REFRESH_THRESHOLD_MS;
}

// ── Legacy prefetch cache ──

interface CacheEntry {
  key: string; // `${date}|${phase}`
  dateKey: string; // DayKey at cache time
  timestamp: number;
  session: TodaySession | null;
}

const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
let cache: CacheEntry | null = null;

// ── Onboarding track cache ──
let onboardingCache: { track: OnboardingTrack | null; timestamp: number } | null = null;

function cacheKey(date: string, phase: ContentPhase): string {
  return `${date}|${phase}`;
}

function isCacheValid(entry: CacheEntry, date: string, phase: ContentPhase): boolean {
  const currentDayKey = ClockService.getLocalDateKey();
  if (entry.dateKey !== currentDayKey) return false; // new day
  if (entry.key !== cacheKey(date, phase)) return false; // different params
  if (Date.now() - entry.timestamp > CACHE_MAX_AGE_MS) return false; // stale
  return true;
}

// ── Day-based query (primary path) ──

/**
 * Fetch the track for a specific program day and phase.
 * Returns null if no track found or Supabase unreachable.
 */
async function getTrackForDay(
  dayNumber: number,
  phase: ContentPhase,
): Promise<DayTrack | null> {
  const client = SupabaseService.getClient();
  if (!client) return null;

  const category = phase; // phase maps directly to category ('lock_in' | 'unlock')

  try {
    // Query audio_tracks directly by day_number + category
    const { data, error } = await client
      .from('audio_tracks')
      .select('id, title, storage_bucket, storage_path, duration_seconds, day_number, core_tenet')
      .eq('day_number', dayNumber)
      .eq('category', category)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[SessionRepository] Day track query error:', error.message);
      return null;
    }

    if (!data) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;

    // Check cache by audioTrackId — reuse if URL still valid
    const cachedEntry = dayTrackCache.get(row.id);
    if (cachedEntry && isDayTrackCacheValid(cachedEntry)) {
      return cachedEntry.track;
    }

    // Sign new URL
    let signedAudioUrl: string;
    try {
      signedAudioUrl = await getSignedAudioUrl(
        client,
        row.storage_bucket,
        row.storage_path,
        SIGNED_URL_TTL_SECONDS,
      );
    } catch {
      return null;
    }

    const track: DayTrack = {
      title: row.title,
      durationSeconds: row.duration_seconds,
      signedAudioUrl,
      audioTrackId: row.id,
      dayNumber: row.day_number,
      phase,
      coreTenet: row.core_tenet ?? null,
    };

    // Cache it
    dayTrackCache.set(row.id, { track, signedAt: Date.now() });

    return track;
  } catch (error) {
    console.warn('[SessionRepository] Day track error:', error);
    return null;
  }
}

/**
 * Prefetch track for a specific program day + phase.
 * Called on Home mount for instant Session screen load.
 */
async function prefetchTrackForDay(
  dayNumber: number,
  phase: ContentPhase,
): Promise<void> {
  await getTrackForDay(dayNumber, phase);
}

// ── Legacy date-based query ──

/**
 * Fetch the session for a given date/phase.
 * Tries primary match first, then falls back to nearest previous.
 * Returns null if nothing found or Supabase is unreachable.
 */
async function getSessionFor(
  date: string,
  phase: ContentPhase,
): Promise<TodaySession | null> {
  // Check prefetch cache
  if (cache && isCacheValid(cache, date, phase)) {
    return cache.session;
  }

  const client = SupabaseService.getClient();
  if (!client) return null;

  try {
    // Primary: exact date match
    const { data: primary, error: primaryErr } = await client
      .from('scheduled_sessions')
      .select(`
        id,
        scheduled_date,
        phase,
        duration_minutes,
        title,
        audio_track_id,
        audio_tracks!inner (
          id,
          storage_bucket,
          storage_path,
          duration_seconds
        )
      `)
      .eq('scheduled_date', date)
      .eq('phase', phase)
      .limit(1)
      .maybeSingle();

    if (primaryErr) {
      console.warn('[SessionRepository] Primary query error:', primaryErr.message);
    }

    if (primary) {
      const session = await buildTodaySession(client, primary, false);
      setCache(date, phase, session);
      return session;
    }

    // Fallback: nearest previous published session for same phase
    const { data: fallback, error: fallbackErr } = await client
      .from('scheduled_sessions')
      .select(`
        id,
        scheduled_date,
        phase,
        duration_minutes,
        title,
        audio_track_id,
        audio_tracks!inner (
          id,
          storage_bucket,
          storage_path,
          duration_seconds
        )
      `)
      .lte('scheduled_date', date)
      .eq('phase', phase)
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackErr) {
      console.warn('[SessionRepository] Fallback query error:', fallbackErr.message);
    }

    if (fallback) {
      const session = await buildTodaySession(client, fallback, true);
      setCache(date, phase, session);
      return session;
    }

    // Nothing found
    setCache(date, phase, null);
    return null;
  } catch (error) {
    console.warn('[SessionRepository] Unexpected error:', error);
    return null;
  }
}

/**
 * Fetch the active onboarding track.
 * Returns null if no onboarding track is configured.
 */
async function getOnboardingTrack(): Promise<OnboardingTrack | null> {
  // Return cached result if fresh (< 10 min)
  if (onboardingCache && Date.now() - onboardingCache.timestamp < CACHE_MAX_AGE_MS) {
    return onboardingCache.track;
  }

  const client = SupabaseService.getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('audio_tracks')
      .select('id, title, storage_bucket, storage_path, duration_seconds')
      .eq('category', 'onboarding')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[SessionRepository] Onboarding track query error:', error.message);
      return null;
    }

    if (!data) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;

    let signedAudioUrl: string;
    try {
      signedAudioUrl = await getSignedAudioUrl(
        client,
        row.storage_bucket,
        row.storage_path,
        SIGNED_URL_TTL_SECONDS,
      );
    } catch {
      return null;
    }

    const result: OnboardingTrack = {
      title: row.title,
      durationSeconds: row.duration_seconds,
      signedAudioUrl,
      audioTrackId: row.id,
    };
    onboardingCache = { track: result, timestamp: Date.now() };
    return result;
  } catch (error) {
    console.warn('[SessionRepository] Onboarding track error:', error);
    return null;
  }
}

/**
 * Build a TodaySession from a raw query result + signed URL.
 */
async function buildTodaySession(
  client: ReturnType<typeof SupabaseService.getClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any,
  isFallback: boolean,
): Promise<TodaySession> {
  const track = Array.isArray(row.audio_tracks) ? row.audio_tracks[0] : row.audio_tracks;
  const durationMinutes: number = row.duration_minutes ?? SESSION_DURATION_MINUTES;

  // Duration-aware TTL: max(30 min, duration * 2.5)
  const ttlSeconds = Math.max(SIGNED_URL_TTL_SECONDS, durationMinutes * 60 * 2.5);

  const signedAudioUrl = await getSignedAudioUrl(
    client!,
    track.storage_bucket,
    track.storage_path,
    ttlSeconds,
  );

  return {
    phase: row.phase,
    scheduledDate: row.scheduled_date,
    durationMinutes,
    durationSeconds: track.duration_seconds,
    title: row.title,
    signedAudioUrl,
    audioTrackId: track.id,
    isFallback,
  };
}

function setCache(
  date: string,
  phase: ContentPhase,
  session: TodaySession | null,
): void {
  cache = {
    key: cacheKey(date, phase),
    dateKey: ClockService.getLocalDateKey(),
    timestamp: Date.now(),
    session,
  };
}

/**
 * Prefetch session for the current phase (legacy date-based).
 */
async function prefetchToday(phase: ContentPhase): Promise<void> {
  const date = ClockService.getLocalDateKey();
  await getSessionFor(date, phase);
}

/**
 * Prefetch onboarding track metadata + pre-load audio into AudioService.
 * Call on EnforceMyFocusScreen mount so audio is ready when session starts.
 * Silent on failure.
 */
async function prefetchOnboardingTrack(): Promise<void> {
  const track = await getOnboardingTrack();
  if (track) {
    const { AudioService } = require('./AudioService');
    await AudioService.load(track.signedAudioUrl);
  }
}

/**
 * Get cached day track info (title + core tenet) without network call.
 * Returns null if no track cached for the given day + phase.
 */
function getCachedDayTrackInfo(
  dayNumber: number,
  phase: ContentPhase,
): { title: string; coreTenet: string | null } | null {
  for (const entry of dayTrackCache.values()) {
    if (
      entry.track.dayNumber === dayNumber &&
      entry.track.phase === phase &&
      isDayTrackCacheValid(entry)
    ) {
      return { title: entry.track.title, coreTenet: entry.track.coreTenet };
    }
  }
  return null;
}

/**
 * Clear all caches (e.g., on day change or logout).
 */
function clearCache(): void {
  cache = null;
  onboardingCache = null;
  dayTrackCache.clear();
}

export const SessionRepository = {
  getSessionFor,
  getTrackForDay,
  prefetchTrackForDay,
  getCachedDayTrackInfo,
  getOnboardingTrack,
  prefetchOnboardingTrack,
  prefetchToday,
  clearCache,
};
