import { Platform } from 'react-native';
import type { ScreenTimeStatus } from '../features/onboarding/state/types';

export class PermissionService {
  static async requestScreenTimePermission(): Promise<ScreenTimeStatus> {
    if (Platform.OS !== 'ios') return 'unavailable';

    try {
      const ScreenTime = await import('../../modules/screen-time/src');
      const result = await ScreenTime.requestAuthorization();

      if (result === 'approved') return 'granted';
      if (result.startsWith('denied')) return 'denied';
      return 'not_requested';
    } catch {
      return 'unavailable';
    }
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
