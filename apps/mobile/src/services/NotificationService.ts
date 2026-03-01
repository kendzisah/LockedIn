/**
 * NotificationService — Schedules recurring local notifications for daily sessions.
 *
 * - Lock In reminder: every day at 5:00 AM (user's local timezone)
 * - Reflect reminder: every day at 8:00 PM (user's local timezone)
 *
 * Uses expo-notifications daily trigger which respects the device timezone.
 * Safe to call multiple times — cancels existing scheduled notifications
 * before re-scheduling to avoid duplicates.
 */

import * as Notifications from 'expo-notifications';

const LOCK_IN_ID = 'daily-lock-in';
const REFLECT_ID = 'daily-reflect';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationService {
  /**
   * Schedule both daily notifications. Idempotent — safe to call on every app boot.
   * Cancels any previously scheduled notifications first to prevent duplicates.
   */
  static async scheduleDailyReminders(): Promise<void> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      await this.cancelAll();

      await Notifications.scheduleNotificationAsync({
        identifier: LOCK_IN_ID,
        content: {
          title: 'Time to Lock In.',
          body: 'Your morning session is ready. Start Day strong.',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 5,
          minute: 0,
        },
      });

      await Notifications.scheduleNotificationAsync({
        identifier: REFLECT_ID,
        content: {
          title: 'Reflect & Close the Day.',
          body: 'Your evening session is ready. Lock in what you built today.',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 20,
          minute: 0,
        },
      });

      console.log('[NotificationService] Daily reminders scheduled (5am + 8pm)');
    } catch (err) {
      console.warn('[NotificationService] Failed to schedule reminders:', err);
    }
  }

  /** Cancel all previously scheduled notifications. */
  static async cancelAll(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (err) {
      console.warn('[NotificationService] Failed to cancel notifications:', err);
    }
  }
}
