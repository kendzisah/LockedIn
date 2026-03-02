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
const LOCK_IN_REMINDER_ID = 'lock-in-evening-reminder';
const EXECUTION_BLOCK_DONE_ID = 'execution-block-done';

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

  /**
   * Schedule a 9 PM daily reminder for incomplete Lock In sessions.
   * Call on app launch / midnight reset when Lock In not yet completed.
   */
  static async scheduleLockInReminder(): Promise<void> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      await this.cancelLockInReminder();

      await Notifications.scheduleNotificationAsync({
        identifier: LOCK_IN_REMINDER_ID,
        content: {
          title: 'Your Lock In is waiting.',
          body: "Don't let the day end without it.",
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 21,
          minute: 0,
        },
      });

      console.log('[NotificationService] Lock In reminder scheduled (9pm)');
    } catch (err) {
      console.warn('[NotificationService] Failed to schedule Lock In reminder:', err);
    }
  }

  /**
   * Schedule a one-shot notification for when an Execution Block ends.
   * Fires at the exact Date provided, even if the app is backgrounded.
   */
  static async scheduleExecutionBlockDone(endDate: Date): Promise<void> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      await this.cancelExecutionBlockDone();

      await Notifications.scheduleNotificationAsync({
        identifier: EXECUTION_BLOCK_DONE_ID,
        content: {
          title: 'Execution Block Complete.',
          body: 'Distraction resisted. Standard raised.',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: endDate,
        },
      });

      console.log('[NotificationService] Execution block done notification scheduled');
    } catch (err) {
      console.warn('[NotificationService] Failed to schedule execution block notification:', err);
    }
  }

  /** Cancel the execution block completion notification. */
  static async cancelExecutionBlockDone(): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(EXECUTION_BLOCK_DONE_ID);
    } catch {
      // Notification may not exist — safe to ignore
    }
  }

  /** Cancel the 9 PM Lock In reminder (called on Lock In completion). */
  static async cancelLockInReminder(): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(LOCK_IN_REMINDER_ID);
    } catch {
      // Notification may not exist — safe to ignore
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
