/**
 * AnalyticsService — Thin wrapper over PostHogService + AppsFlyerService.
 *
 * Auto-attaches default properties to every PostHog event:
 *   is_anonymous, is_subscribed, streak_days, guild_count, app_version
 *
 * Event names and property keys passed to `track()` are normalized to
 * `snake_case` so the 100+ call sites still using human-readable Title Case
 * names (e.g. "Session Completed") emit the canonical PostHog name
 * (`session_completed`) without any call-site edits. Property keys beginning
 * with `$` are PostHog-reserved and pass through verbatim.
 *
 * AppsFlyer events (`trackAF`) bypass the normalizer — AppsFlyer event names
 * are an external contract (`af_*`) and must NOT be mutated.
 *
 * Usage:
 *   Analytics.track('Session Started', { duration_minutes: 30 });
 *   Analytics.identify(userId);
 *   Analytics.setUserProperties({ primary_goal: 'Build discipline' });
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PostHogService } from './PostHogService';
import { AppsFlyerService } from './AppsFlyerService';

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';
const HAS_ACTIVE_GUILD_KEY = '@lockedin/has_active_guild';

// ── Mutable context updated by providers ──

let _isAnonymous = true;
let _isSubscribed = false;
let _streakDays = 0;
let _guildCount = 0;

/**
 * Build default properties attached to every PostHog event.
 * Reads from in-memory context (fast, no async).
 */
function getDefaultProperties(): Record<string, unknown> {
  return {
    is_anonymous: _isAnonymous,
    is_subscribed: _isSubscribed,
    streak_days: _streakDays,
    guild_count: _guildCount,
    app_version: APP_VERSION,
    platform: Platform.OS,
  };
}

/**
 * Convert an event name or property key to PostHog `snake_case`.
 * Handles spaces, dashes, camelCase/PascalCase, and existing snake_case input.
 *
 * Keys starting with `$` are PostHog-reserved (`$set`, `$set_once`, `$name`,
 * `$email`, …) and pass through unchanged.
 *
 * Examples:
 *   "Session Completed" → "session_completed"
 *   "Paywall CTA Tapped" → "paywall_cta_tapped"
 *   "errorCode" → "error_code"
 *   "$email" → "$email"
 */
function toSnakeCase(input: string): string {
  if (!input) return input;
  if (input.startsWith('$')) return input;
  return input
    // camelCase / PascalCase boundary → underscore
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // whitespace / dashes / slashes → underscore
    .replace(/[\s\-/]+/g, '_')
    // collapse repeats and strip non-alphanumeric (besides _)
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function normalizeProps(props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!props) return props;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    const normalized = key.startsWith('$') ? key : toSnakeCase(key);
    out[normalized] = props[key];
  }
  return out;
}

export const Analytics = {
  // ── Context setters (called by providers) ──

  setIsAnonymous(val: boolean) {
    _isAnonymous = val;
  },

  setIsSubscribed(val: boolean) {
    _isSubscribed = val;
  },

  setStreakDays(val: number) {
    _streakDays = val;
  },

  /**
   * Hydrate guild count from AsyncStorage (call on boot).
   */
  async hydrateGuildCount(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(HAS_ACTIVE_GUILD_KEY);
      // We only store a boolean flag; estimate count as 0 or 1.
      // Exact count is set when GuildService.getMyGuilds() runs.
      _guildCount = raw === 'true' ? 1 : 0;
    } catch {}
  },

  // ── Core API ──

  /**
   * Track a PostHog event with auto-attached default properties.
   * Event names and non-`$`-prefixed property keys are normalized to snake_case.
   */
  track(event: string, properties?: Record<string, unknown>): void {
    const normalizedEvent = toSnakeCase(event);
    const merged = {
      ...getDefaultProperties(),
      ...(normalizeProps(properties) ?? {}),
    };
    PostHogService.track(normalizedEvent, merged);
  },

  /**
   * Track an AppsFlyer event. Values must be string-typed for AF SDK.
   * AppsFlyer event names (`af_*`) are NOT normalized.
   */
  trackAF(event: string, values: Record<string, string> = {}): void {
    AppsFlyerService.logEvent(event, values);
  },

  /**
   * Identify the user in PostHog (call on sign-up, sign-in, boot).
   * Per briefing, pass the Supabase `auth.users.id` so identity matches
   * the admin dashboard and Supabase.
   */
  async identify(userId: string): Promise<void> {
    await PostHogService.identify(userId);
  },

  /**
   * Set persistent user properties in PostHog (overwrites existing).
   */
  async setUserProperties(props: Record<string, unknown>): Promise<void> {
    await PostHogService.setUserProperties(normalizeProps(props) ?? {});
  },

  /**
   * Set persistent user properties only if not already set.
   */
  async setUserPropertiesOnce(props: Record<string, unknown>): Promise<void> {
    await PostHogService.setUserPropertiesOnce(normalizeProps(props) ?? {});
  },

  /**
   * Register super properties that are auto-attached to every PostHog event.
   */
  registerSuperProperties(props: Record<string, unknown>): void {
    PostHogService.registerSuperProperties(normalizeProps(props) ?? {});
  },

  /**
   * Start timing an event. Call track(event) later to record the duration.
   * `duration_ms` and `duration_seconds` will be attached automatically.
   */
  timeEvent(event: string): void {
    PostHogService.timeEvent(toSnakeCase(event));
  },

  /**
   * Forward an exception/error to PostHog's error tracking with optional
   * structured properties (e.g. `error_type`, `error_code`).
   */
  captureException(error: unknown, properties?: Record<string, unknown>): void {
    const merged = {
      ...getDefaultProperties(),
      ...(normalizeProps(properties) ?? {}),
    };
    PostHogService.captureException(error, merged);
  },

  /**
   * Reset identity (call on sign-out).
   */
  reset(): void {
    PostHogService.reset();
  },

  /**
   * Reset mutable context vars (call on sign-out alongside reset()).
   */
  resetContext(): void {
    _isAnonymous = true;
    _isSubscribed = false;
    _streakDays = 0;
    _guildCount = 0;
  },
};

// ── Global error handlers ──

let globalHandlersInstalled = false;

/**
 * Install RN-global handlers so uncaught JS errors and unhandled promise
 * rejections are forwarded to PostHog. Call once during app boot, after
 * `PostHogService.initialize()`.
 *
 * - `ErrorUtils.setGlobalHandler` catches synchronous uncaught JS errors.
 * - We hook the global `Promise.unhandledrejection` event via the polyfill
 *   exposed in HermesInternal / promise-rejection-tracking.
 */
export function installGlobalErrorHandlers(): void {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  // ErrorUtils is provided by React Native at the global scope (no public
  // type, hence the cast).
  type RNErrorUtils = {
    getGlobalHandler: () => (error: any, isFatal?: boolean) => void;
    setGlobalHandler: (handler: (error: any, isFatal?: boolean) => void) => void;
  };
  const errorUtils: RNErrorUtils | undefined = (global as any).ErrorUtils;
  if (errorUtils) {
    const previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      try {
        Analytics.captureException(error, { is_fatal: !!isFatal });
      } catch {
        /* swallow — never let the error handler crash the error handler */
      }
      // Let RN's default red-box still fire so dev visibility is preserved.
      try {
        previousHandler?.(error, isFatal);
      } catch {
        /* ignore */
      }
    });
  }

  // Unhandled promise rejections. RN's promise polyfill emits these via
  // the global `HermesInternal.hasPromise()` / `process` shim. The most
  // portable hook is to listen on the global event-target if present.
  try {
    const g: any = global as any;
    if (typeof g.addEventListener === 'function') {
      g.addEventListener('unhandledrejection', (event: any) => {
        try {
          const reason = event?.reason ?? event;
          Analytics.captureException(reason, { unhandled_rejection: true });
        } catch {
          /* ignore */
        }
      });
    } else if (g.HermesInternal?.enablePromiseRejectionTracker) {
      g.HermesInternal.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled: (_id: number, rejection: any) => {
          try {
            Analytics.captureException(rejection, { unhandled_rejection: true });
          } catch {
            /* ignore */
          }
        },
      });
    }
  } catch {
    /* unhandled rejection hookup is best-effort */
  }
}
