import type { ScreenTimeStatus } from '../features/onboarding/state/types';

/**
 * Permission service.
 * Screen Time: stubbed for Phase 1.
 * Notifications: real expo-notifications integration (lazy-loaded to avoid
 * crash when native module isn't yet in the dev build binary).
 */
export class PermissionService {
  /**
   * Request Screen Time / app-blocking permission.
   * Phase 1: returns 'requested' — real implementation in Phase 2+.
   * iOS: Family Controls entitlement required.
   * Android: Usage Access / DND permission required.
   */
  static async requestScreenTimePermission(): Promise<ScreenTimeStatus> {
    // TODO (Phase 2+): Implement real Screen Time permission request
    // iOS — FamilyControls AuthorizationCenter
    // Android — UsageStatsManager / DND policy
    return 'requested';
  }

  /**
   * Request notification permission via expo-notifications.
   * Uses dynamic import so the app doesn't crash at startup if the native
   * module isn't in the current dev build. Returns true if granted, false
   * if denied or if the module is unavailable.
   */
  static async requestNotificationPermission(): Promise<boolean> {
    try {
      const Notifications = await import('expo-notifications');

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      if (existingStatus === 'granted') {
        return true;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      // Native module not available — dev build needs rebuild.
      // Gracefully return false so onboarding can continue.
      return false;
    }
  }
}
