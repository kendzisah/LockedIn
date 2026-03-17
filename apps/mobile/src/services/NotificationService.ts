/**
 * NotificationService — Schedules local notifications for LockedIn.
 *
 * Notification categories:
 *   - Daily Alignment (7:00 AM)
 *   - Streak motivator (9:00 AM) — dynamic copy based on streak count
 *   - Lock-In reminders (12 PM, 5 PM, 9 PM) — progressive urgency
 *   - Nightly Reflection (8:00 PM)
 *   - Close-to-goal nudge — one-shot 30 min after session if >= 80% of goal
 *   - Execution block done — one-shot at block end time
 *
 * Uses expo-notifications DAILY triggers (device timezone).
 * Safe to call multiple times — cancels before re-scheduling.
 */

import * as Notifications from 'expo-notifications';

// ─── Notification IDs ────────────────────────────────────────────
const ALIGNMENT_ID = 'daily-alignment';
const STREAK_ID = 'daily-streak';
const LOCK_IN_NOON_ID = 'lock-in-reminder-noon';
const LOCK_IN_AFTERNOON_ID = 'lock-in-reminder-afternoon';
const LOCK_IN_EVENING_ID = 'lock-in-reminder-evening';
const REFLECT_ID = 'daily-reflect';
const CLOSE_TO_GOAL_ID = 'close-to-goal-nudge';
const EXECUTION_BLOCK_DONE_ID = 'execution-block-done';

const LOCK_IN_REMINDER_IDS = [LOCK_IN_NOON_ID, LOCK_IN_AFTERNOON_ID, LOCK_IN_EVENING_ID];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function hasPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

async function cancelById(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // May not exist — safe to ignore
  }
}

export class NotificationService {
  /**
   * Schedule all daily notifications. Idempotent — cancels existing before re-scheduling.
   * Call on app boot and after notification permission is granted.
   */
  static async scheduleAllDailyNotifications(streak: number): Promise<void> {
    try {
      if (!(await hasPermission())) return;
      await this.cancelAll();

      // 7:00 AM — Daily Alignment
      await Notifications.scheduleNotificationAsync({
        identifier: ALIGNMENT_ID,
        content: {
          title: 'Your Daily Alignment is ready.',
          body: 'Start your morning with intention. Learn from those who built empires.',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 7,
          minute: 0,
        },
      });

      // 9:00 AM — Streak motivator
      const streakContent = streak > 0
        ? {
            title: 'Keep the streak alive.',
            body: `You're on a ${streak}-day streak. Lock in today to keep building.`,
          }
        : {
            title: 'Start your streak today.',
            body: 'Every streak starts with one focused day. Lock in and build consistency.',
          };

      await Notifications.scheduleNotificationAsync({
        identifier: STREAK_ID,
        content: {
          ...streakContent,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 9,
          minute: 0,
        },
      });

      // Lock-In reminders (12 PM, 5 PM, 9 PM)
      await this.scheduleLockInReminders();

      // 8:00 PM — Nightly Reflection
      await Notifications.scheduleNotificationAsync({
        identifier: REFLECT_ID,
        content: {
          title: 'Time to reflect.',
          body: 'Your Nightly Reflection is ready. Close the day with clarity.',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 20,
          minute: 0,
        },
      });

      console.log('[NotificationService] All daily notifications scheduled');
    } catch (err) {
      console.warn('[NotificationService] Failed to schedule daily notifications:', err);
    }
  }

  /**
   * Schedule the three progressive lock-in reminders.
   * Called as part of scheduleAllDailyNotifications and can be cancelled
   * independently when the user hits their daily goal.
   */
  static async scheduleLockInReminders(): Promise<void> {
    try {
      if (!(await hasPermission())) return;

      // 12:00 PM
      await Notifications.scheduleNotificationAsync({
        identifier: LOCK_IN_NOON_ID,
        content: {
          title: 'Still time to lock in.',
          body: "You haven't hit your daily goal yet. Stay disciplined.",
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 12,
          minute: 0,
        },
      });

      // 5:00 PM
      await Notifications.scheduleNotificationAsync({
        identifier: LOCK_IN_AFTERNOON_ID,
        content: {
          title: "Don't let today slip.",
          body: 'You still have time to lock in and stay on track.',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 17,
          minute: 0,
        },
      });

      // 9:00 PM
      await Notifications.scheduleNotificationAsync({
        identifier: LOCK_IN_EVENING_ID,
        content: {
          title: 'Last call to lock in.',
          body: 'Your daily goal resets at midnight. Finish what you started.',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 21,
          minute: 0,
        },
      });
    } catch (err) {
      console.warn('[NotificationService] Failed to schedule lock-in reminders:', err);
    }
  }

  /** Cancel all three lock-in reminder notifications. */
  static async cancelLockInReminders(): Promise<void> {
    for (const id of LOCK_IN_REMINDER_IDS) {
      await cancelById(id);
    }
  }

  /**
   * Schedule a one-shot nudge 30 minutes from now when user is close to goal.
   */
  static async scheduleCloseToGoalNudge(): Promise<void> {
    try {
      if (!(await hasPermission())) return;
      await this.cancelCloseToGoalNudge();

      const fireDate = new Date(Date.now() + 30 * 60 * 1000);

      await Notifications.scheduleNotificationAsync({
        identifier: CLOSE_TO_GOAL_ID,
        content: {
          title: "You're almost there.",
          body: "Just a little more focus and you'll hit your daily goal. Don't stop now.",
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
        },
      });

      console.log('[NotificationService] Close-to-goal nudge scheduled (30 min)');
    } catch (err) {
      console.warn('[NotificationService] Failed to schedule close-to-goal nudge:', err);
    }
  }

  /** Cancel the close-to-goal nudge. */
  static async cancelCloseToGoalNudge(): Promise<void> {
    await cancelById(CLOSE_TO_GOAL_ID);
  }

  /**
   * Schedule a one-shot notification for when an Execution Block ends.
   */
  static async scheduleExecutionBlockDone(endDate: Date): Promise<void> {
    try {
      if (!(await hasPermission())) return;
      await this.cancelExecutionBlockDone();

      await Notifications.scheduleNotificationAsync({
        identifier: EXECUTION_BLOCK_DONE_ID,
        content: {
          title: 'Lock In Complete.',
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
    await cancelById(EXECUTION_BLOCK_DONE_ID);
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
