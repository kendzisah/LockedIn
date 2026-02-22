/**
 * SessionRepository — Fetches scheduled sessions with fallback logic
 * and generates signed URLs for audio playback.
 *
 * All sessions are ~5 min. No duration parameter needed.
 *
 * Query strategy:
 *  1. Primary: exact match on date + phase (today's content)
 *  2. Fallback: nearest previous published session for same phase
 *  3. Returns null if nothing found (empty DB / offline)
 *
 * Prefetch: called on Home mount, caches result for instant Session screen load.
 * Cache invalidated after 10 min or on new day (via ClockService.getLocalDateKey).
 */

import type { ContentPhase } from '@lockedin/shared-types';
import { getSignedAudioUrl } from '@lockedin/supabase-client';
import { SupabaseService } from './SupabaseService';
import { ClockService } from './ClockService';

// ── Constants ──

const SESSION_DURATION_MINUTES = 5;

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

export interface OnboardingTrack {
  title: string;
  durationSeconds: number;
  signedAudioUrl: string;
  audioTrackId: string;
}

// ── Prefetch cache ──

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

// ── Core query ──

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
        1800, // 30 min TTL
      );
    } catch (urlError) {
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
  const ttlSeconds = Math.max(1800, durationMinutes * 60 * 2.5);

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
 * Prefetch session for the current phase.
 * Called on Home mount so the Session screen gets instant data.
 * Silent on failure.
 */
async function prefetchToday(phase: ContentPhase): Promise<void> {
  const date = ClockService.getLocalDateKey();
  await getSessionFor(date, phase);
}

/**
 * Clear the prefetch cache (e.g., on day change).
 */
/**
 * Prefetch onboarding track metadata + pre-load audio into AudioService.
 * Call on QuickLockInIntroScreen mount so audio is ready when session starts.
 * Silent on failure.
 */
async function prefetchOnboardingTrack(): Promise<void> {
  const track = await getOnboardingTrack();
  if (track) {
    // Pre-load into AudioService (will be a no-op on SessionScreen if already loaded)
    const { AudioService } = require('./AudioService');
    await AudioService.load(track.signedAudioUrl);
  }
}

function clearCache(): void {
  cache = null;
  onboardingCache = null;
}

export const SessionRepository = {
  getSessionFor,
  getOnboardingTrack,
  prefetchOnboardingTrack,
  prefetchToday,
  clearCache,
};
