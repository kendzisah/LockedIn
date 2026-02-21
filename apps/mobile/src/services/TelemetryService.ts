/**
 * TelemetryService — Lightweight event logging.
 *
 * MVP: structured console.log in dev. No external dependencies.
 * Ready to wire to Supabase `analytics` table or third-party (Amplitude, PostHog).
 *
 * Events:
 *   session_started    — { phase, duration, hasAudio }
 *   session_completed  — { phase, duration, hasAudio }
 *   session_exited_early — { phase, duration, elapsedSeconds }
 *   audio_load_failed  — { phase, duration, error }
 *   fallback_used      — { phase, duration, fallbackDate }
 *   auth_initialized   — { isNewUser }
 */

type EventParams = Record<string, string | number | boolean>;

function logEvent(name: string, params?: EventParams): void {
  if (__DEV__) {
    console.log(`[Telemetry] ${name}`, params ?? {});
  }

  // TODO: Wire to backend (Supabase analytics table / third-party SDK)
  // Example future implementation:
  // analyticsQueue.push({ name, params, timestamp: Date.now() });
  // flushIfNeeded();
}

export const TelemetryService = {
  logEvent,
};
