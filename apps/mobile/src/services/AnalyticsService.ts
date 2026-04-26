/**
 * AnalyticsService — Thin wrapper over MixpanelService + AppsFlyerService.
 *
 * Auto-attaches default properties to every Mixpanel event:
 *   is_anonymous, is_subscribed, streak_days, guild_count, app_version
 *
 * Usage:
 *   Analytics.track('Session Started', { duration_minutes: 30 });
 *   Analytics.identify(userId);
 *   Analytics.setUserProperties({ primary_goal: 'Build discipline' });
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MixpanelService } from './MixpanelService';
import { AppsFlyerService } from './AppsFlyerService';

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';
const HAS_ACTIVE_GUILD_KEY = '@lockedin/has_active_guild';

// ── Mutable context updated by providers ──

let _isAnonymous = true;
let _isSubscribed = false;
let _streakDays = 0;
let _guildCount = 0;

/**
 * Build default properties attached to every Mixpanel event.
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
   * Register super properties that are auto-attached to every Mixpanel event.
   */
  registerSuperProperties(props: Record<string, unknown>): void {
    MixpanelService.registerSuperProperties(props);
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
