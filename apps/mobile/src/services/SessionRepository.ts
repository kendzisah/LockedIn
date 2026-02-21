/**
 * SessionRepository — Fetches scheduled sessions with fallback logic
 * and generates duration-aware signed URLs for audio playback.
 *
 * Query strategy:
 *  1. Primary: exact match on date + phase + duration (today's content)
 *  2. Fallback: nearest previous published session for same phase + duration
 *  3. Returns null if nothing found (empty DB / offline)
 *
 * Prefetch: called on Home mount, caches result for instant Session screen load.
 * Cache invalidated after 10 min or on new day (via ClockService.getLocalDateKey).
 */

import type { ContentPhase, SessionDuration } from '@lockedin/shared-types';
import { getSignedAudioUrl } from '@lockedin/supabase-client';
import { SupabaseService } from './SupabaseService';
import { ClockService } from './ClockService';

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

// ── Prefetch cache ──

interface CacheEntry {
  key: string; // `${date}|${phase}|${duration}`
  dateKey: string; // DayKey at cache time
  timestamp: number;
  session: TodaySession | null;
}

const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
let cache: CacheEntry | null = null;

function cacheKey(date: string, phase: ContentPhase, duration: SessionDuration): string {
  return `${date}|${phase}|${duration}`;
}

function isCacheValid(entry: CacheEntry, date: string, phase: ContentPhase, duration: SessionDuration): boolean {
  const currentDayKey = ClockService.getLocalDateKey();
  if (entry.dateKey !== currentDayKey) return false; // new day
  if (entry.key !== cacheKey(date, phase, duration)) return false; // different params
  if (Date.now() - entry.timestamp > CACHE_MAX_AGE_MS) return false; // stale
  return true;
}

// ── Core query ──

/**
 * Fetch the session for a given date/phase/duration.
 * Tries primary match first, then falls back to nearest previous.
 * Returns null if nothing found or Supabase is unreachable.
 */
async function getSessionFor(
  date: string,
  phase: ContentPhase,
  durationMinutes: SessionDuration,
): Promise<TodaySession | null> {
  // Check prefetch cache
  if (cache && isCacheValid(cache, date, phase, durationMinutes)) {
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
      .eq('duration_minutes', durationMinutes)
      .limit(1)
      .maybeSingle();

    if (primaryErr) {
      console.warn('[SessionRepository] Primary query error:', primaryErr.message);
    }

    if (primary) {
      const session = await buildTodaySession(client, primary, false);
      setCache(date, phase, durationMinutes, session);
      return session;
    }

    // Fallback: nearest previous published session for same phase + duration
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
      .eq('duration_minutes', durationMinutes)
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackErr) {
      console.warn('[SessionRepository] Fallback query error:', fallbackErr.message);
    }

    if (fallback) {
      const session = await buildTodaySession(client, fallback, true);
      setCache(date, phase, durationMinutes, session);
      return session;
    }

    // Nothing found
    setCache(date, phase, durationMinutes, null);
    return null;
  } catch (error) {
    console.warn('[SessionRepository] Unexpected error:', error);
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
  const durationMinutes: number = row.duration_minutes;

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
  duration: SessionDuration,
  session: TodaySession | null,
): void {
  cache = {
    key: cacheKey(date, phase, duration),
    dateKey: ClockService.getLocalDateKey(),
    timestamp: Date.now(),
    session,
  };
}

/**
 * Prefetch session for the current phase/duration.
 * Called on Home mount so the Session screen gets instant data.
 * Silent on failure.
 */
async function prefetchToday(
  phase: ContentPhase,
  durationMinutes: SessionDuration,
): Promise<void> {
  const date = ClockService.getLocalDateKey();
  await getSessionFor(date, phase, durationMinutes);
}

/**
 * Clear the prefetch cache (e.g., on day change).
 */
function clearCache(): void {
  cache = null;
}

export const SessionRepository = {
  getSessionFor,
  prefetchToday,
  clearCache,
};
