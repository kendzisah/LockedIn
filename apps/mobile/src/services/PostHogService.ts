/**
 * PostHogService — Singleton PostHog client wrapper for the RN app.
 *
 * The public surface mirrors what AnalyticsService consumes (`track`,
 * `identify`, `setUserProperties`, `setUserPropertiesOnce`,
 * `registerSuperProperties`, `reset`, `timeEvent`, `captureException`,
 * `getDistinctId`) so the 100+ `Analytics.*` call sites compile unchanged.
 *
 * Behavioral notes:
 * - `captureNativeAppLifecycleEvents` is **off** — we emit `App Opened` and
 *   `App Returned` ourselves from App.tsx.
 * - Session Replay is enabled at the client level; sample rate is controlled
 *   in PostHog Project Settings (briefing requires 100%, configured remotely).
 * - `timeEvent` has no native PostHog equivalent; we emulate it in-memory and
 *   attach `duration_ms` + `duration_seconds` on the matching `track()`.
 * - We do NOT eagerly identify to the auto-generated anonymous distinct_id on
 *   boot. The first explicit `identify(supabaseUserId)` is what creates a
 *   Person row, matching the briefing's `identifiedOnly` posture.
 */

import { PostHog } from 'posthog-react-native';
import { ENV } from '../config/env';

let client: PostHog | null = null;
let readyPromise: Promise<void> | null = null;

// In-memory map of `event_name -> Date.now()` for the timeEvent emulation.
const timedEvents = new Map<string, number>();

export const PostHogService = {
  /**
   * Initialize the PostHog client. Idempotent — second calls are a no-op.
   * Must be called before any `track`/`identify` to avoid the warmup window.
   */
  async initialize(): Promise<void> {
    if (client) return;

    try {
      const apiKey = ENV.POSTHOG_API_KEY;
      const host = ENV.POSTHOG_HOST;
      if (!apiKey) {
        console.warn('[PostHog] EXPO_PUBLIC_POSTHOG_API_KEY missing — analytics disabled');
        return;
      }

      client = new PostHog(apiKey, {
        host,
        // Auto-lifecycle is OFF — App.tsx emits our own `App Opened`/`App Returned`.
        captureNativeAppLifecycleEvents: false,
        // Session replay disabled — event analytics + error tracking only.
        enableSessionReplay: false,
        // Persist session across cold starts so replays line up with the same session.
        enablePersistSessionIdAcrossRestart: true,
        // Default flush cadence is reasonable; explicit for documentation.
        flushAt: 20,
        flushInterval: 10_000,
      });

      readyPromise = client.ready();
      await readyPromise;

      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[PostHog] Initialized — distinct_id:', client.getDistinctId());
      }
    } catch (e) {
      console.warn('[PostHog] init failed:', e);
    }
  },

  /**
   * Capture an event. Emulates `timeEvent` by attaching
   * `duration_ms`/`duration_seconds` when a matching `timeEvent(event)` was
   * called earlier.
   */
  track(event: string, properties?: Record<string, unknown>): void {
    try {
      if (!client) return;

      let merged = (properties ?? {}) as Record<string, unknown>;
      const startedAt = timedEvents.get(event);
      if (typeof startedAt === 'number') {
        const elapsedMs = Date.now() - startedAt;
        merged = {
          duration_ms: elapsedMs,
          duration_seconds: Math.round(elapsedMs / 1000),
          ...merged,
        };
        timedEvents.delete(event);
      }

      client.capture(event, merged as Record<string, any>);
    } catch (e) {
      console.warn(`[PostHog] track(${event}) failed:`, e);
    }
  },

  /**
   * Identify the user. Per briefing, callers should pass the Supabase
   * `auth.users.id` (not RevenueCat's appUserId) so PostHog identity
   * lines up with the admin dashboard.
   */
  async identify(userId: string, properties?: Record<string, unknown>): Promise<void> {
    try {
      if (!client) return;
      if (readyPromise) await readyPromise;
      client.identify(userId, properties as Record<string, any> | undefined);
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[PostHog] Identified:', userId);
      }
    } catch (e) {
      console.warn('[PostHog] identify failed:', e);
    }
  },

  /**
   * Person properties (overwrite). Translated to PostHog's `$set` modifier.
   */
  async setUserProperties(props: Record<string, unknown>): Promise<void> {
    try {
      if (!client) return;
      if (readyPromise) await readyPromise;
      // PostHog convention: `$set` on an `$identify`/`$set` event updates Person props.
      client.capture('$set', { $set: props as Record<string, any> });
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[PostHog] setUserProperties:', Object.keys(props).join(', '));
      }
    } catch (e) {
      console.warn('[PostHog] setUserProperties failed:', e);
    }
  },

  /**
   * Person properties (only-set-if-unset). Uses `$set_once`.
   */
  async setUserPropertiesOnce(props: Record<string, unknown>): Promise<void> {
    try {
      if (!client) return;
      if (readyPromise) await readyPromise;
      client.capture('$set', { $set_once: props as Record<string, any> });
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[PostHog] setUserPropertiesOnce:', Object.keys(props).join(', '));
      }
    } catch (e) {
      console.warn('[PostHog] setUserPropertiesOnce failed:', e);
    }
  },

  /**
   * Super properties — attached to every subsequent event. PostHog calls
   * these `register`. Persisted across app launches.
   */
  registerSuperProperties(props: Record<string, unknown>): void {
    try {
      void client?.register(props as Record<string, any>);
    } catch (e) {
      console.warn('[PostHog] registerSuperProperties failed:', e);
    }
  },

  /**
   * Reset identity (call on sign-out). PostHog generates a fresh anonymous
   * distinct_id; super-properties and queued events are cleared.
   */
  reset(): void {
    try {
      client?.reset();
      timedEvents.clear();
    } catch (e) {
      console.warn('[PostHog] reset failed:', e);
    }
  },

  /**
   * Start a timer for `event`. The next `track(event, ...)` will receive
   * `duration_ms` + `duration_seconds` properties automatically.
   * Calling `timeEvent` again for the same event overwrites the start time.
   */
  timeEvent(event: string): void {
    try {
      timedEvents.set(event, Date.now());
    } catch (e) {
      console.warn(`[PostHog] timeEvent(${event}) failed:`, e);
    }
  },

  /**
   * Forward an exception/error to PostHog's error tracking.
   * `additionalProperties` is merged into the event.
   */
  captureException(error: unknown, additionalProperties?: Record<string, unknown>): void {
    try {
      client?.captureException(error, additionalProperties as Record<string, any>);
    } catch (e) {
      console.warn('[PostHog] captureException failed:', e);
    }
  },

  /**
   * Returns the current PostHog distinct ID (anonymous or identified).
   */
  getDistinctId(): string | null {
    try {
      return client?.getDistinctId() ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Expose the underlying client for advanced use (e.g. mounting in a
   * `PostHogProvider` for autocapture / feature flags). Returns `null`
   * before `initialize()` has run.
   */
  getClient(): PostHog | null {
    return client;
  },
};
