//
//  NotificationService.swift
//  LockedIn
//
//  Centralised local notification scheduler. Replaces the RN
//  `NotificationService` (`apps/mobile/src/services/NotificationService.ts`)
//  which used `expo-notifications`; here we use `UserNotifications` directly.
//
//  All scheduling is purely local — confirmed by Agent A's backend audit
//  (no `user_push_tokens` table, no server push). The DAM extension is the
//  only other surface that interacts with notifications and it does so
//  through the Managed Settings shield, not UNUserNotificationCenter.
//
//  Persisted UserDefaults keys this service owns (all match RN exactly):
//   - `@lockedin/notif_user_disabled` — master off toggle
//   - `@lockedin/notif_streak_alerts` — streak-alert opt-in
//   - `@lockedin/notif_guild_updates` — guild-updates opt-in
//   - `@lockedin/reminder_time`  — "HH:mm" 24h daily reminder
//   - `@lockedin/has_active_guild`    — for guild-nudge gating
//
//  Notification IDs (stable strings for cancel-by-id):
//   - `lockedin.daily_reminder`
//   - `lockedin.execution_block_done`
//   - `lockedin.streak_milestone`
//   - `lockedin.streak_protection`
//   - `lockedin.first_guild_nudge`
//   - `lockedin.close_to_goal`
//   - `lockedin.mission_reminder`
//   - `lockedin.first_session_reminder`
//

import Foundation
import UserNotifications

/// Local time-of-day helper.
public struct HourMinute: Equatable, Sendable {
    public let hour: Int
    public let minute: Int

    public init(hour: Int, minute: Int) {
        self.hour = max(0, min(23, hour))
        self.minute = max(0, min(59, minute))
    }

    /// Parses "HH:mm". Returns nil for malformed strings.
    public static func parse(_ raw: String?) -> HourMinute? {
        guard let raw, raw.contains(":") else { return nil }
        let parts = raw.split(separator: ":")
        guard parts.count >= 2,
              let h = Int(parts[0]),
              let m = Int(parts[1])
        else { return nil }
        return HourMinute(hour: h, minute: m)
    }
}

@MainActor
public final class NotificationService {
    public static let shared = NotificationService()

    private init() {}

    // MARK: - Identifiers

    public enum ID {
        public static let dailyReminder         = "lockedin.daily_reminder"
        public static let executionBlockDone    = "lockedin.execution_block_done"
        public static let streakMilestone       = "lockedin.streak_milestone"
        public static let streakProtection      = "lockedin.streak_protection"
        public static let firstGuildNudge       = "lockedin.first_guild_nudge"
        public static let closeToGoal           = "lockedin.close_to_goal"
        public static let missionReminder       = "lockedin.mission_reminder"
        public static let firstSessionReminder  = "lockedin.first_session_reminder"
        public static let guildMonthEnd         = "lockedin.guild_month_end"
        /// Prefix for per-occurrence scheduled-session "starting now" notifications.
        public static let scheduledSessionPrefix = "lockedin.scheduled_session"
    }

    // MARK: - Authorization

    /// Request `.alert + .sound + .badge`. Returns `true` if the user granted
    /// either provisional or full authorization.
    public func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            return try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    public func currentAuthorizationStatus() async -> UNAuthorizationStatus {
        await withCheckedContinuation { cont in
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                cont.resume(returning: settings.authorizationStatus)
            }
        }
    }

    // MARK: - Daily reminder

    /// Schedule a repeating daily reminder at the supplied local time.
    public func scheduleDailyReminder(at time: HourMinute) {
        let content = UNMutableNotificationContent()
        content.title = "Time to Lock In"
        content.body = "Open Locked In and start today's focus session."
        content.sound = .default

        var components = DateComponents()
        components.hour = time.hour
        components.minute = time.minute

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(identifier: ID.dailyReminder, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request) { _ in }
    }

    public func cancelDailyReminder() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [ID.dailyReminder]
        )
    }

    // MARK: - Scheduled sessions

    /// Re-schedule the "starting now" heads-up notifications for every enabled
    /// scheduled session (one per recurring weekday, or one fire-once for a
    /// one-off). Cancels all prior scheduled-session notifications first. Also
    /// the standalone fallback when Family Controls auto-block is unavailable.
    public func resyncScheduledSessionNotifications(_ sessions: [ScheduledSession]) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { requests in
            let stale = requests
                .map(\.identifier)
                .filter { $0.hasPrefix(ID.scheduledSessionPrefix) }
            if !stale.isEmpty {
                center.removePendingNotificationRequests(withIdentifiers: stale)
            }

            for s in sessions where s.enabled && s.isValid {
                let content = UNMutableNotificationContent()
                content.title = s.label.isEmpty ? "Locking in now" : "\(s.label) — locking in"
                content.body = "Your scheduled focus session is starting. Distractions are blocked."
                content.sound = .default

                if s.isOneOff {
                    guard let next = s.nextOccurrence() else { continue }
                    let comps = Calendar.current.dateComponents(
                        [.year, .month, .day, .hour, .minute], from: next
                    )
                    let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
                    let id = "\(ID.scheduledSessionPrefix).\(s.id).oneoff"
                    center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger)) { _ in }
                } else {
                    for wd in s.weekdays {
                        var comps = DateComponents()
                        comps.weekday = wd
                        comps.hour = s.startHour
                        comps.minute = s.startMinute
                        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
                        let id = "\(ID.scheduledSessionPrefix).\(s.id).\(wd)"
                        center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger)) { _ in }
                    }
                }
            }
        }
    }

    // MARK: - Execution block done

    /// Fire-once notification at the session end time. Used when the user
    /// backgrounds the app during a session — the local notif reminds them to
    /// return when the block completes.
    public func scheduleExecutionBlockDone(endsAt: Date) {
        cancelExecutionBlockDone()
        let interval = endsAt.timeIntervalSinceNow
        guard interval > 0 else { return }

        let content = UNMutableNotificationContent()
        content.title = "Session Complete"
        content.body = "Your lock-in block is done. Open the app to seal the win."
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let request = UNNotificationRequest(identifier: ID.executionBlockDone, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request) { _ in }
    }

    public func cancelExecutionBlockDone() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [ID.executionBlockDone]
        )
    }

    // MARK: - Streak milestones

    /// Fire a single milestone toast for the current streak if the streak
    /// crosses one of the known thresholds. Dedupes via `@lockedin/af_streak_milestones_sent`
    /// so repeated calls in the same session don't re-fire.
    public func scheduleStreakMilestoneIfNeeded(currentStreak: Int) {
        let thresholds = [3, 7, 14, 30, 60, 90, 180, 365]
        guard thresholds.contains(currentStreak) else { return }

        let sentRaw = Defaults.string("@lockedin/af_streak_milestones_sent") ?? "[]"
        var sent: [Int] = (try? JSONDecoder().decode([Int].self, from: Data(sentRaw.utf8))) ?? []
        if sent.contains(currentStreak) { return }

        let content = UNMutableNotificationContent()
        content.title = "\(currentStreak)-day streak"
        content.body = streakCopy(forDays: currentStreak)
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let request = UNNotificationRequest(
            identifier: "\(ID.streakMilestone).\(currentStreak)",
            content: content,
            trigger: trigger
        )
        UNUserNotificationCenter.current().add(request) { _ in }

        sent.append(currentStreak)
        if let data = try? JSONEncoder().encode(sent),
           let str = String(data: data, encoding: .utf8) {
            Defaults.setString(str, "@lockedin/af_streak_milestones_sent")
        }
    }

    private func streakCopy(forDays days: Int) -> String {
        switch days {
        case 3:   return "3 days in. The pattern is forming."
        case 7:   return "One week locked in. Don't break the chain."
        case 14:  return "Two weeks. The system is yours now."
        case 30:  return "30 days. You proved you can do this."
        case 60:  return "60 days. This is who you are."
        case 90:  return "90 days. Quarterly discipline unlocked."
        case 180: return "Six months. Built different."
        case 365: return "One year locked in. Legend status."
        default:  return "Discipline compounds."
        }
    }

    // MARK: - Cancel-all

    public func cancelAllNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }

    // MARK: - Guild nudges

    /// Schedule a one-time nudge encouraging the user to join their first
    /// guild. No-op when the user already has an active guild.
    public func scheduleFirstGuildNudgeIfNeeded(hasActiveGuild: Bool) {
        guard !hasActiveGuild else {
            UNUserNotificationCenter.current().removePendingNotificationRequests(
                withIdentifiers: [ID.firstGuildNudge]
            )
            return
        }

        let content = UNMutableNotificationContent()
        content.title = "Find your guild"
        content.body = "Lock in with people on the same mission."
        content.sound = .default

        // 24h from now.
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 24 * 60 * 60, repeats: false)
        let request = UNNotificationRequest(identifier: ID.firstGuildNudge, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request) { _ in }
    }

    /// Arm the month-end guild reminder: a one-shot local notification on the
    /// last day of the month at 10:00 local, nudging the user to check where
    /// they landed before the leaderboard resets. No-op (and cancels any
    /// pending one) when the user isn't in a guild.
    ///
    /// "Last day of month" can't be expressed by a repeating calendar trigger
    /// (28/29/30/31 varies), so this schedules a single dated trigger and is
    /// re-armed on every app launch / foreground — which also rolls it forward
    /// to the next month after it fires.
    public func scheduleGuildMonthEndReminder(hasActiveGuild: Bool) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [ID.guildMonthEnd])
        guard hasActiveGuild, let fireDate = Self.nextMonthEndReminderDate() else { return }

        let content = UNMutableNotificationContent()
        content.title = "Rankings lock tonight"
        content.body = "Final day of the month — your guild standings reset at midnight. Make your last push and lock in your spot on the board."
        content.sound = .default

        let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let request = UNNotificationRequest(identifier: ID.guildMonthEnd, content: content, trigger: trigger)
        center.add(request) { _ in }
    }

    /// The next "last day of month at `hour`:00 local" that is still in the
    /// future — this month's if it hasn't passed, otherwise next month's.
    static func nextMonthEndReminderDate(now: Date = Date(), hour: Int = 10) -> Date? {
        let cal = Calendar.current
        func lastDay(of date: Date) -> Date? {
            guard let range = cal.range(of: .day, in: .month, for: date) else { return nil }
            var comps = cal.dateComponents([.year, .month], from: date)
            comps.day = range.upperBound - 1
            comps.hour = hour
            comps.minute = 0
            return cal.date(from: comps)
        }
        if let thisMonth = lastDay(of: now), thisMonth > now { return thisMonth }
        guard let nextMonth = cal.date(byAdding: .month, value: 1, to: now) else { return nil }
        return lastDay(of: nextMonth)
    }

    /// Refresh the rolling daily-notification schedule based on stored state.
    /// Reads streak, reminder time, and guild flag from `UserDefaults` so the
    /// service stays decoupled from feature states.
    public func refreshScheduleWithStoredStreak() {
        let userDisabled = Defaults.bool("@lockedin/notif_user_disabled")
        if userDisabled {
            cancelAllNotifications()
            return
        }

        let streak = Defaults.int("@lockedin/streak_for_notifs") // cached snapshot
        let hasGuild = Defaults.bool("@lockedin/has_active_guild")
        let goalMinutes = Defaults.int("@lockedin/daily_minutes")
        let reminder = HourMinute.parse(Defaults.string("@lockedin/reminder_time"))
            ?? HourMinute(hour: 9, minute: 0)

        scheduleAllDailyNotifications(
            streak: streak,
            hasGuild: hasGuild,
            goalMinutes: goalMinutes > 0 ? goalMinutes : 60,
            reminderTime: reminder
        )
    }

    // MARK: - Close-to-goal nudge

    /// Schedule a nudge when the user is within 20% of their daily goal.
    public func scheduleCloseToGoalNudge(focusMinutes: Int, goalMinutes: Int) {
        guard goalMinutes > 0 else { return }
        let remaining = max(0, goalMinutes - focusMinutes)
        let pct = Double(focusMinutes) / Double(goalMinutes)
        // Only fire when 80% ≤ progress < 100%.
        guard pct >= 0.8, pct < 1.0 else { return }

        let content = UNMutableNotificationContent()
        content.title = "Almost there"
        content.body = "\(remaining) more minute\(remaining == 1 ? "" : "s") to seal today."
        content.sound = .default

        // Fire in 30 minutes.
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 30 * 60, repeats: false)
        let request = UNNotificationRequest(identifier: ID.closeToGoal, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request) { _ in }
    }

    // MARK: - Lock-in / mission cancellation

    public func cancelLockInReminders() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [ID.dailyReminder, ID.executionBlockDone, ID.closeToGoal]
        )
    }

    public func cancelMissionReminder() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [ID.missionReminder]
        )
    }

    // MARK: - Session completion hook

    /// Called by the session completion screen — clears any pending "almost
    /// there" / "execution block done" reminders so the user doesn't get a
    /// stale ping after sealing their day.
    public func onSessionCompletedToday() {
        cancelExecutionBlockDone()
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [ID.closeToGoal, ID.missionReminder, ID.streakProtection]
        )
    }

    // MARK: - Daily roll-up

    /// Re-schedule the standard daily notification set: reminder, optional
    /// streak-protection ping, optional guild nudge. Idempotent — overwrites
    /// any previously scheduled instance.
    public func scheduleAllDailyNotifications(
        streak: Int,
        hasGuild: Bool,
        goalMinutes: Int,
        reminderTime: HourMinute
    ) {
        // Daily reminder.
        scheduleDailyReminder(at: reminderTime)

        // Streak-protection ping in the evening if the user has any streak.
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [ID.streakProtection]
        )
        if streak > 0 {
            var comps = DateComponents()
            comps.hour = 20
            comps.minute = 0

            let content = UNMutableNotificationContent()
            content.title = "Protect your \(streak)-day streak"
            content.body = "Lock in before midnight to keep the chain alive."
            content.sound = .default

            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
            let request = UNNotificationRequest(identifier: ID.streakProtection, content: content, trigger: trigger)
            UNUserNotificationCenter.current().add(request) { _ in }
        }

        // Persist the streak snapshot so `refreshScheduleWithStoredStreak`
        // has something to read.
        Defaults.setInt(streak, "@lockedin/streak_for_notifs")
        Defaults.setInt(goalMinutes, "@lockedin/daily_minutes")
        Defaults.setBool(hasGuild, "@lockedin/has_active_guild")

        if !hasGuild {
            scheduleFirstGuildNudgeIfNeeded(hasActiveGuild: false)
        }
    }
}
