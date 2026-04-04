/**
 * NotificationService — Local scheduled notifications (expo-notifications).
 * V2: no push server; device timezone for all calendar triggers.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { ClockService } from './ClockService';
import type { Mission } from '../features/missions/MissionEngine';

// ─── Identifiers ───────────────────────────────────────────────

const ID_MORNING = 'lockin-reminder-morning';
const ID_EVENING = 'lockin-reminder-evening';
const ID_CLOSE_TO_GOAL = 'close-to-goal';
const ID_STREAK_PROTECT = 'streak-protect';
const ID_MISSION_REMINDER = 'mission-reminder';
const ID_CREW_WEEKLY = 'crew-weekly';
const ID_CREW_FIRST_NUDGE = 'crew-first-nudge';
const ID_WIN_BACK_1 = 'win-back-1';
const ID_WIN_BACK_3 = 'win-back-3';
const ID_WIN_BACK_7 = 'win-back-7';
const EXECUTION_BLOCK_DONE_ID = 'execution-block-done';

const MASTER_BATCH_IDS = [
  ID_MORNING,
  ID_EVENING,
  ID_STREAK_PROTECT,
  ID_MISSION_REMINDER,
  ID_CREW_WEEKLY,
  ID_WIN_BACK_1,
  ID_WIN_BACK_3,
  ID_WIN_BACK_7,
] as const;

// ─── AsyncStorage keys ─────────────────────────────────────────

const KEY_SESSION = '@lockedin/session_state';
const KEY_MISSIONS = '@lockedin/daily_missions';
const KEY_MISSION_DATE = '@lockedin/daily_missions_date';
const KEY_MILESTONE_SENT = '@lockedin/milestone_notifs_sent';
const KEY_CREW_FIRST_NUDGE = '@lockedin/crew_first_nudge_sent';
const KEY_LAST_APP_OPEN = '@lockedin/last_app_open';
const KEY_CREW_CACHED_RANK = '@lockedin/crew_cached_rank';
const KEY_HAS_ACTIVE_CREW = '@lockedin/has_active_crew';
const KEY_NOTIF_PERMISSION = '@lockedin/notif_permission_granted';
export const KEY_NOTIF_USER_DISABLED = '@lockedin/notif_user_disabled';
const KEY_REMINDER_TIME = '@lockedin/reminder_time';
const KEY_NOTIF_STREAK_ALERTS = '@lockedin/notif_streak_alerts';
const KEY_NOTIF_CREW_UPDATES = '@lockedin/notif_crew_updates';

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365] as const;

export type NotificationNavScreen = 'Home' | 'CrewDetail' | 'CrewList';

export type NotificationPayload = {
  type:
    | 'lockin-reminder'
    | 'streak-protect'
    | 'mission-reminder'
    | 'crew-weekly'
    | 'win-back'
    | 'milestone'
    | 'close-to-goal'
    | 'crew-first-nudge';
  screen: NotificationNavScreen;
  crew_id?: string;
};

let channelReady = false;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Locked In',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3A66FF',
      sound: 'default',
    });
    channelReady = true;
  } catch {
    /* ignore */
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

void ensureAndroidChannel();

function dayOfYear(d: Date = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

async function cancelById(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* may not exist */
  }
}

async function cancelMasterBatch(): Promise<void> {
  for (const id of MASTER_BATCH_IDS) {
    await cancelById(id);
  }
}

async function readNotifUserDisabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_NOTIF_USER_DISABLED)) === 'true';
  } catch {
    return false;
  }
}

async function readStreakAlertsEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_NOTIF_STREAK_ALERTS)) !== 'false';
  } catch {
    return true;
  }
}

async function readCrewNotifEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_NOTIF_CREW_UPDATES)) !== 'false';
  } catch {
    return true;
  }
}

/** 24h HH:mm for daily morning reminder; default 09:00 */
export async function readReminderTimeHHmm(): Promise<{ hour: number; minute: number }> {
  try {
    const raw = await AsyncStorage.getItem(KEY_REMINDER_TIME);
    if (raw && /^\d{1,2}:\d{2}$/.test(raw)) {
      const [h, m] = raw.split(':').map((x) => parseInt(x, 10));
      if (h >= 0 && h < 24 && m >= 0 && m < 60) return { hour: h, minute: m };
    }
  } catch {
    /* default */
  }
  return { hour: 9, minute: 0 };
}

export function formatReminderHHmmAs12h(hhmm: { hour: number; minute: number }): string {
  const h24 = hhmm.hour;
  const m = hhmm.minute;
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const mm = String(m).padStart(2, '0');
  return `${h12}:${mm} ${period}`;
}

export async function persistReminderTimeHHmm(hour: number, minute: number): Promise<void> {
  const h = Math.max(0, Math.min(23, hour));
  const min = Math.max(0, Math.min(59, minute));
  await AsyncStorage.setItem(
    KEY_REMINDER_TIME,
    `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
  );
}

async function readSessionLastLockInDate(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SESSION);
    if (!raw) return null;
    const p = JSON.parse(raw) as { lastLockInCompletedDate?: string | null };
    return p.lastLockInCompletedDate ?? null;
  } catch {
    return null;
  }
}

async function readMissionCompletionCount(): Promise<number> {
  try {
    const today = ClockService.getLocalDateKey();
    const [rawMissions, rawDate] = await Promise.all([
      AsyncStorage.getItem(KEY_MISSIONS),
      AsyncStorage.getItem(KEY_MISSION_DATE),
    ]);
    if (!rawMissions || rawDate !== today) return 0;
    const missions = JSON.parse(rawMissions) as Mission[];
    return missions.filter((m) => m.completed).length;
  } catch {
    return 0;
  }
}

async function readHasActiveCrew(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY_HAS_ACTIVE_CREW);
    return v === 'true';
  } catch {
    return false;
  }
}

async function readCrewCachedRank(): Promise<{ crew_name: string; rank: number; crew_id?: string }> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CREW_CACHED_RANK);
    if (!raw) return { crew_name: 'your crew', rank: 1 };
    const p = JSON.parse(raw) as { crew_name?: string; rank?: number; crew_id?: string };
    return {
      crew_name: typeof p.crew_name === 'string' ? p.crew_name : 'your crew',
      rank: typeof p.rank === 'number' && p.rank > 0 ? p.rank : 1,
      crew_id: typeof p.crew_id === 'string' ? p.crew_id : undefined,
    };
  } catch {
    return { crew_name: 'your crew', rank: 1 };
  }
}

function streakProtectCopy(streak: number): { title: string; body: string } {
  if (streak <= 6) {
    return {
      title: `Don't lose your ${streak}-day streak.`,
      body: "You've come this far. One session keeps it alive.",
    };
  }
  if (streak <= 29) {
    return {
      title: `🔥 ${streak} days on the line.`,
      body: "A week+ of discipline. Don't throw it away for one lazy day.",
    };
  }
  if (streak <= 89) {
    return {
      title: `🔥 ${streak} days. Legendary.`,
      body: 'Less than 1% make it this far. Lock in and keep climbing.',
    };
  }
  return {
    title: `🔥 ${streak} days. Untouchable.`,
    body: "You're in rare air. Don't come back down.",
  };
}

function morningCopy(streak: number): { title: string; body: string } {
  const variants: { title: string; body: string }[] = [
    {
      title: 'Time to lock in.',
      body: "Your future self is watching. Start today's session.",
    },
    {
      title: `Day ${streak + 1} starts now.`,
      body: "Don't break the chain. Lock in.",
    },
    {
      title: "Everyone's still sleeping.",
      body: 'Get ahead while they scroll.',
    },
    {
      title: "No one said it'd be easy.",
      body: "That's why most people quit. You won't.",
    },
  ];
  const idx = dayOfYear() % variants.length;
  return variants[idx];
}

function eveningCopy(streak: number): { title: string; body: string } {
  const variants: { title: string; body: string }[] = [
    {
      title: 'You still have time.',
      body: "10 minutes before bed. Lock in and keep the streak alive.",
    },
    {
      title: "Don't let today be the day.",
      body: `You've built ${streak} days. Finish strong.`,
    },
  ];
  const idx = dayOfYear() % variants.length;
  return variants[idx];
}

const androidExtras =
  Platform.OS === 'android' ? ({ android: { channelId: 'default' } } as const) : {};

export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') {
        await AsyncStorage.setItem(KEY_NOTIF_PERMISSION, 'true');
        return true;
      }
      const { status } = await Notifications.requestPermissionsAsync();
      const ok = status === 'granted';
      await AsyncStorage.setItem(KEY_NOTIF_PERMISSION, ok ? 'true' : 'false');
      return ok;
    } catch {
      await AsyncStorage.setItem(KEY_NOTIF_PERMISSION, 'false');
      return false;
    }
  }

  /** Persist last open time (win-back baseline). Call from App boot. */
  static async touchLastAppOpen(): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY_LAST_APP_OPEN, new Date().toISOString());
    } catch {
      /* ignore */
    }
  }

  /** Re-run master scheduler using streak from persisted session (after crew join/leave). */
  static async refreshScheduleWithStoredStreak(): Promise<void> {
    let streak = 0;
    try {
      const raw = await AsyncStorage.getItem(KEY_SESSION);
      if (raw) {
        const p = JSON.parse(raw) as { consecutiveStreak?: number };
        streak = typeof p.consecutiveStreak === 'number' ? p.consecutiveStreak : 0;
      }
    } catch {
      streak = 0;
    }
    await this.scheduleAllDailyNotifications(streak);
  }

  /**
   * Master scheduler: refreshes recurring daily/weekly + win-back batch.
   * Does not cancel one-shots: close-to-goal, milestones, crew-first-nudge, execution block.
   */
  static async scheduleAllDailyNotifications(streak: number): Promise<void> {
    try {
      if (await readNotifUserDisabled()) return;

      await ensureAndroidChannel();
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      await cancelMasterBatch();

      const todayKey = ClockService.getLocalDateKey();
      const lastLock = await readSessionLastLockInDate();
      const sessionToday = lastLock === todayKey;
      const missionDone = await readMissionCompletionCount();
      const hasCrew = await readHasActiveCrew();
      const streakAlertsOn = await readStreakAlertsEnabled();
      const crewNotifOn = await readCrewNotifEnabled();
      const { hour: morningHour, minute: morningMinute } = await readReminderTimeHHmm();

      // a. Morning lock-in (time from settings)
      const morn = morningCopy(streak);
      await Notifications.scheduleNotificationAsync({
        identifier: ID_MORNING,
        content: {
          title: morn.title,
          body: morn.body,
          sound: 'default',
          data: {
            type: 'lockin-reminder',
            screen: 'Home',
          } satisfies NotificationPayload,
          ...androidExtras,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: morningHour,
          minute: morningMinute,
        },
      });

      // b. Evening 7 PM — only if no session today
      if (!sessionToday) {
        const ev = eveningCopy(streak);
        await Notifications.scheduleNotificationAsync({
          identifier: ID_EVENING,
          content: {
            title: ev.title,
            body: ev.body,
            sound: 'default',
            data: {
              type: 'lockin-reminder',
              screen: 'Home',
            } satisfies NotificationPayload,
            ...androidExtras,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 19,
            minute: 0,
          },
        });
      }

      // c. Streak protect 5 PM — no session today and streak > 0
      if (streakAlertsOn && !sessionToday && streak > 0) {
        const sp = streakProtectCopy(streak);
        await Notifications.scheduleNotificationAsync({
          identifier: ID_STREAK_PROTECT,
          content: {
            title: sp.title,
            body: sp.body,
            sound: 'default',
            data: {
              type: 'streak-protect',
              screen: 'Home',
            } satisfies NotificationPayload,
            ...androidExtras,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 17,
            minute: 0,
          },
        });
      }

      // d. Mission reminder 8 PM — < 3 missions today
      if (missionDone < 3) {
        const remaining = 3 - missionDone;
        const s = remaining === 1 ? '' : 's';
        const useCrewCopy = hasCrew && dayOfYear() % 2 === 0;
        await Notifications.scheduleNotificationAsync({
          identifier: ID_MISSION_REMINDER,
          content: {
            title: useCrewCopy ? 'Your crew is watching.' : 'Unfinished business.',
            body: useCrewCopy
              ? `${remaining} mission${s} left. Every one counts for your crew score.`
              : `${remaining} mission${s} left today. Don't leave points on the table.`,
            sound: 'default',
            data: {
              type: 'mission-reminder',
              screen: 'Home',
            } satisfies NotificationPayload,
            ...androidExtras,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 20,
            minute: 0,
          },
        });
      }

      // e. Crew weekly — Sunday 6 PM
      if (hasCrew && crewNotifOn) {
        const { crew_name, rank, crew_id } = await readCrewCachedRank();
        await Notifications.scheduleNotificationAsync({
          identifier: ID_CREW_WEEKLY,
          content: {
            title: 'Crew leaderboard resets tomorrow.',
            body: `You're #${rank} in ${crew_name}. Lock in tonight to finish strong.`,
            sound: 'default',
            data: {
              type: 'crew-weekly',
              screen: crew_id ? 'CrewDetail' : 'CrewList',
              ...(crew_id ? { crew_id } : {}),
            } satisfies NotificationPayload,
            ...androidExtras,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: 1,
            hour: 18,
            minute: 0,
          },
        });
      }

      // f. Win-back relative to now
      const now = Date.now();
      const scheduleWinBack = async (id: string, delayMs: number, title: string, body: string) => {
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title,
            body,
            sound: 'default',
            data: {
              type: 'win-back',
              screen: 'Home',
            } satisfies NotificationPayload,
            ...androidExtras,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(now + delayMs),
          },
        });
      };

      await scheduleWinBack(
        ID_WIN_BACK_1,
        24 * 60 * 60 * 1000,
        'You missed yesterday.',
        "That's okay. Champions don't quit after one bad day. Come back.",
      );
      await scheduleWinBack(
        ID_WIN_BACK_3,
        72 * 60 * 60 * 1000,
        '3 days without a session.',
        "The version of you that started this didn't quit. Neither should you.",
      );
      await scheduleWinBack(
        ID_WIN_BACK_7,
        7 * 24 * 60 * 60 * 1000,
        "It's been a week.",
        "Your streak is gone, but the app isn't. Start fresh. Day 1 again.",
      );
    } catch (err) {
      console.warn('[NotificationService] scheduleAllDailyNotifications failed:', err);
    }
  }

  static async cancelLockInReminders(): Promise<void> {
    await cancelById(ID_MORNING);
    await cancelById(ID_EVENING);
  }

  static async scheduleCloseToGoalNudge(remainingMinutes: number): Promise<void> {
    try {
      if (await readNotifUserDisabled()) return;
      await ensureAndroidChannel();
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      await cancelById(ID_CLOSE_TO_GOAL);

      const mins = Math.max(1, Math.ceil(remainingMinutes));
      await Notifications.scheduleNotificationAsync({
        identifier: ID_CLOSE_TO_GOAL,
        content: {
          title: "You're almost there.",
          body: `Just ${mins} minutes left to hit your goal. Finish what you started.`,
          sound: 'default',
          data: {
            type: 'close-to-goal',
            screen: 'Home',
          } satisfies NotificationPayload,
          ...androidExtras,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
    } catch (err) {
      console.warn('[NotificationService] scheduleCloseToGoalNudge failed:', err);
    }
  }

  static async cancelCloseToGoalNudge(): Promise<void> {
    await cancelById(ID_CLOSE_TO_GOAL);
  }

  /** Refresh weekly crew recap (e.g. after first join). */
  static async scheduleCrewReminder(): Promise<void> {
    try {
      if (await readNotifUserDisabled()) return;
      if (!(await readCrewNotifEnabled())) return;
      await ensureAndroidChannel();
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      await cancelById(ID_CREW_WEEKLY);
      const hasCrew = await readHasActiveCrew();
      if (!hasCrew) return;
      const { crew_name, rank, crew_id } = await readCrewCachedRank();
      await Notifications.scheduleNotificationAsync({
        identifier: ID_CREW_WEEKLY,
        content: {
          title: 'Crew leaderboard resets tomorrow.',
          body: `You're #${rank} in ${crew_name}. Lock in tonight to finish strong.`,
          sound: 'default',
          data: {
            type: 'crew-weekly',
            screen: crew_id ? 'CrewDetail' : 'CrewList',
            ...(crew_id ? { crew_id } : {}),
          } satisfies NotificationPayload,
          ...androidExtras,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: 1,
          hour: 18,
          minute: 0,
        },
      });
    } catch (err) {
      console.warn('[NotificationService] scheduleCrewReminder failed:', err);
    }
  }

  static async cancelMissionReminder(): Promise<void> {
    await cancelById(ID_MISSION_REMINDER);
  }

  /** One-time 24h after first crew; call only when user had no crew before join/create. */
  static async scheduleFirstCrewNudgeIfNeeded(): Promise<void> {
    try {
      if (await readNotifUserDisabled()) return;
      if (!(await readCrewNotifEnabled())) return;
      const sent = await AsyncStorage.getItem(KEY_CREW_FIRST_NUDGE);
      if (sent === 'true') return;
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      await ensureAndroidChannel();
      await cancelById(ID_CREW_FIRST_NUDGE);

      await Notifications.scheduleNotificationAsync({
        identifier: ID_CREW_FIRST_NUDGE,
        content: {
          title: 'Your crew is waiting.',
          body: "Lock in a session to get on the leaderboard. Don't let them win.",
          sound: 'default',
          data: {
            type: 'crew-first-nudge',
            screen: 'CrewList',
          } satisfies NotificationPayload,
          ...androidExtras,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await AsyncStorage.setItem(KEY_CREW_FIRST_NUDGE, 'true');
    } catch (err) {
      console.warn('[NotificationService] scheduleFirstCrewNudgeIfNeeded failed:', err);
    }
  }

  static async cancelStreakProtectAndMissionReminders(): Promise<void> {
    await cancelById(ID_STREAK_PROTECT);
    await cancelById(ID_MISSION_REMINDER);
  }

  /** After a focus session completes today — cancel same-day risk nudges. */
  static async onSessionCompletedToday(): Promise<void> {
    await cancelById(ID_EVENING);
    await cancelById(ID_STREAK_PROTECT);
  }

  static async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (err) {
      console.warn('[NotificationService] cancelAllNotifications failed:', err);
    }
  }

  static async scheduleExecutionBlockDone(endDate: Date): Promise<void> {
    try {
      if (await readNotifUserDisabled()) return;
      await ensureAndroidChannel();
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      await cancelById(EXECUTION_BLOCK_DONE_ID);

      await Notifications.scheduleNotificationAsync({
        identifier: EXECUTION_BLOCK_DONE_ID,
        content: {
          title: 'Lock In Complete.',
          body: 'Distraction resisted. Standard raised.',
          sound: 'default',
          data: { type: 'lockin-reminder', screen: 'Home' } satisfies NotificationPayload,
          ...androidExtras,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: endDate,
        },
      });
    } catch (err) {
      console.warn('[NotificationService] scheduleExecutionBlockDone failed:', err);
    }
  }

  static async cancelExecutionBlockDone(): Promise<void> {
    await cancelById(EXECUTION_BLOCK_DONE_ID);
  }

  static async scheduleStreakMilestoneIfNeeded(streak: number): Promise<void> {
    try {
      if (await readNotifUserDisabled()) return;
      if (!(STREAK_MILESTONES as readonly number[]).includes(streak)) return;
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      await ensureAndroidChannel();

      let sent: number[] = [];
      try {
        const raw = await AsyncStorage.getItem(KEY_MILESTONE_SENT);
        if (raw) sent = JSON.parse(raw) as number[];
      } catch {
        sent = [];
      }
      if (!Array.isArray(sent)) sent = [];
      if (sent.includes(streak)) return;

      const copy: Record<number, { title: string; body: string }> = {
        3: {
          title: '3-day streak 🔥',
          body: "Most people quit by day 2. You didn't.",
        },
        7: {
          title: '1 week locked in 🔥',
          body: 'You just outperformed 90% of people who try this.',
        },
        14: {
          title: '2 weeks. No excuses.',
          body: "This isn't luck anymore. This is discipline.",
        },
        30: {
          title: '30 days. New identity.',
          body: "You're not trying to be disciplined. You ARE disciplined.",
        },
        60: {
          title: '60 days. Unbreakable.',
          body: 'The habits are automatic now. Keep stacking.',
        },
        90: {
          title: '90 days. Elite.',
          body: "You've done what most people only talk about.",
        },
        180: {
          title: '6 months locked in.',
          body: 'Half a year of showing up. The results speak for themselves.',
        },
        365: {
          title: 'One full year. 💎',
          body: "365 days of discipline. You're proof it's possible.",
        },
      };

      const c = copy[streak];
      if (!c) return;

      const id = `streak-milestone-${streak}`;
      await cancelById(id);

      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: c.title,
          body: c.body,
          sound: 'default',
          data: {
            type: 'milestone',
            screen: 'Home',
          } satisfies NotificationPayload,
          ...androidExtras,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(Date.now() + 2000),
        },
      });

      sent.push(streak);
      await AsyncStorage.setItem(KEY_MILESTONE_SENT, JSON.stringify(sent));
    } catch (err) {
      console.warn('[NotificationService] scheduleStreakMilestoneIfNeeded failed:', err);
    }
  }

  /** User turned master push off/on in Settings (persists + reschedules). */
  static async setPushMasterEnabled(enabled: boolean, streak: number): Promise<void> {
    try {
      if (enabled) {
        await AsyncStorage.removeItem(KEY_NOTIF_USER_DISABLED);
        const ok = await this.requestPermission();
        if (ok) await this.scheduleAllDailyNotifications(streak);
      } else {
        await AsyncStorage.setItem(KEY_NOTIF_USER_DISABLED, 'true');
        await this.cancelAllNotifications();
      }
    } catch (e) {
      console.warn('[NotificationService] setPushMasterEnabled failed:', e);
    }
  }

  static async setStreakAlertsPreference(enabled: boolean, streak: number): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY_NOTIF_STREAK_ALERTS, enabled ? 'true' : 'false');
      await this.scheduleAllDailyNotifications(streak);
    } catch (e) {
      console.warn('[NotificationService] setStreakAlertsPreference failed:', e);
    }
  }

  static async setCrewNotifPreference(enabled: boolean, streak: number): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY_NOTIF_CREW_UPDATES, enabled ? 'true' : 'false');
      await this.scheduleAllDailyNotifications(streak);
    } catch (e) {
      console.warn('[NotificationService] setCrewNotifPreference failed:', e);
    }
  }
}
