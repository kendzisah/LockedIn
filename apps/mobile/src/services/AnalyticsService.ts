/**
 * AnalyticsService — Thin wrapper over MixpanelService + AppsFlyerService.
 *
 * Auto-attaches default properties to every Mixpanel event:
 *   is_anonymous, is_subscribed, streak_days, crew_count, app_version
 *
 * Usage:
 *   Analytics.track('Session Started', { duration_minutes: 30 });
 *   Analytics.identify(userId);
 *   Analytics.setUserProperties({ primary_goal: 'Build discipline' });
 */

import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MixpanelService } from './MixpanelService';
import { AppsFlyerService } from './AppsFlyerService';

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';
const HAS_ACTIVE_CREW_KEY = '@lockedin/has_active_crew';
const WEEK_STATS_KEY = '@lockedin/crew_week_stats';

// ── Mutable context updated by providers ──

let _isAnonymous = true;
let _isSubscribed = false;
let _streakDays = 0;
let _crewCount = 0;

/**
 * Build default properties attached to every Mixpanel event.
 * Reads from in-memory context (fast, no async).
 */
function getDefaultProperties(): Record<string, unknown> {
  return {
    is_anonymous: _isAnonymous,
    is_subscribed: _isSubscribed,
    streak_days: _streakDays,
    crew_count: _crewCount,
    app_version: APP_VERSION,
    platform: 'ios',
  };
}

export const Analytics = {
  // ── Context setters (called by providers) ──

  setAnonymous(val: boolean) {
    _isAnonymous = val;
  },

  setSubscribed(val: boolean) {
    _isSubscribed = val;
  },

  setStreakDays(val: number) {
    _streakDays = val;
  },

  setCrewCount(val: number) {
    _crewCount = val;
  },

  /**
   * Hydrate crew count from AsyncStorage (call on boot).
   */
  async hydrateCrewCount(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(HAS_ACTIVE_CREW_KEY);
      // We only store a boolean flag; estimate count as 0 or 1.
      // Exact count is set when CrewService.getMyCrews() runs.
      _crewCount = raw === 'true' ? 1 : 0;
    } catch {}
  },

  /**
   * Hydrate streak days from weekly stats (call on boot).
   */
  async hydrateStreakDays(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(WEEK_STATS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.streak_days === 'number') {
          _streakDays = parsed.streak_days;
        }
      }
    } catch {}
  },

  // ── Core API ──

  /**
   * Track a Mixpanel event with auto-attached default properties.
   */
  track(event: string, properties?: Record<string, unknown>): void {
    MixpanelService.track(event, {
      ...getDefaultProperties(),
      ...properties,
    });
  },

  /**
   * Track an AppsFlyer event. Values must be string-typed for AF SDK.
   */
  trackAF(event: string, values: Record<string, string> = {}): void {
    AppsFlyerService.logEvent(event, values);
  },

  /**
   * Identify the user in Mixpanel (call on sign-up, sign-in, boot).
   */
  async identify(userId: string): Promise<void> {
    await MixpanelService.identify(userId);
  },

  /**
   * Set persistent user properties in Mixpanel (overwrites existing).
   */
  async setUserProperties(props: Record<string, unknown>): Promise<void> {
    await MixpanelService.setUserProperties(props);
  },

  /**
   * Set persistent user properties only if not already set.
   */
  async setUserPropertiesOnce(props: Record<string, unknown>): Promise<void> {
    await MixpanelService.setUserPropertiesOnce(props);
  },

  /**
   * Start timing an event. Call track(event) later to record the duration.
   */
  timeEvent(event: string): void {
    MixpanelService.timeEvent(event);
  },

  /**
   * Reset identity (call on sign-out).
   */
  reset(): void {
    MixpanelService.reset();
  },
};
