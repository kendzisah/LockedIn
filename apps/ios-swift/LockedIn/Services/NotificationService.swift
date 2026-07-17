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

    /// Local hour (0–23) for the midday "haven't locked in yet" streak nudge.
    public static let streakRiskNoonHour = 12
    /// Local hour for the evening streak nudge. Kept in sync with the in-app
    /// at-risk banner (`HomeState.streakAtRiskHour`) so the banner and the
    /// evening ping surface together.
    public static let streakRiskEveningHour = 18

    // MARK: - Identifiers

    public enum ID {
        public static let dailyReminder         = "lockedin.daily_reminder"
        public static let executionBlockDone    = "lockedin.execution_block_done"
        public static let breakEnded            = "lockedin.break_ended"
        public static let streakMilestone       = "lockedin.streak_milestone"
        public static let streakProtection      = "lockedin.streak_protection"       // evening
        public static let streakProtectionNoon  = "lockedin.streak_protection_noon"  // midday
        public static let firstGuildNudge       = "lockedin.first_guild_nudge"
        public static let closeToGoal           = "lockedin.close_to_goal"
        public static let missionReminder       = "lockedin.mission_reminder"
        public static let firstSessionReminder  = "lockedin.first_session_reminder"
        public static let guildMonthEnd         = "lockedin.guild_month_end"
        /// Prefix for per-occurrence scheduled-session "starting now" notifications.
        public static let scheduledSessionPrefix = "lockedin.scheduled_session"
        /// Prefix for per-occurrence scheduled-session "complete" notifications.
        /// Shares the `scheduledSessionPrefix` root so the resync stale-sweep
        /// (`hasPrefix(scheduledSessionPrefix)`) removes both in one pass.
        public static let scheduledSessionEndPrefix = "lockedin.scheduled_session.end"
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

    /// How many upcoming occurrences per session get a start+end notification
    /// pair. iOS caps PENDING local notifications at 64 per app and silently
    /// drops requests beyond it. The previous per-weekday repeating model cost
    /// up to 14 pending requests per session (7 weekdays × start/end), so 4–5
    /// sessions starved every other notification in the app. Two absolute
    /// occurrences ⇒ ≤4 pending per session, and the horizon is rolled forward
    /// by `ScheduledSessionsStore.resyncMonitoring()` on every foreground.
    private static let scheduledOccurrenceHorizon = 2

    /// Re-schedule the "starting now" heads-up notifications for every enabled
    /// scheduled session: one absolute, NON-repeating start/end pair for each
    /// of the next `scheduledOccurrenceHorizon` occurrences (a one-off has a
    /// single occurrence, so it collapses into the same loop). Cancels all
    /// prior scheduled-session notifications first. Also the standalone
    /// fallback when Family Controls auto-block is unavailable.
    ///
    /// Identifiers are `"<prefix>.<sessionId>.<yyyy-MM-dd>"` (and the
    /// end-prefix equivalent) — date-scoped so consecutive occurrences don't
    /// overwrite each other, and covered by the `scheduledSessionPrefix` sweep.
    public func resyncScheduledSessionNotifications(_ sessions: [ScheduledSession]) {
        let center = UNUserNotificationCenter.current()
        let horizon = Self.scheduledOccurrenceHorizon
        center.getPendingNotificationRequests { requests in
            let stale = requests
                .map(\.identifier)
                .filter { $0.hasPrefix(ID.scheduledSessionPrefix) }
            if !stale.isEmpty {
                center.removePendingNotificationRequests(withIdentifiers: stale)
            }

            let cal = Calendar.current
            let now = Date()

            for s in sessions where s.enabled && s.isValid {
                let content = UNMutableNotificationContent()
                content.title = s.label.isEmpty ? "Locking in now" : "\(s.label) — locking in"
                content.body = "Your scheduled focus session is starting. Distractions are blocked."
                content.sound = .default

                // Completion notification at the window END, so a scheduled session
                // that runs in the background (app never opened) still tells the user
                // when it's done. The in-app `scheduleExecutionBlockDone` is skipped
                // for scheduled sessions so these don't double-fire.
                let endContent = UNMutableNotificationContent()
                endContent.title = "Session Complete"
                endContent.body = s.label.isEmpty
                    ? "Your scheduled lock-in is done. Nice work."
                    : "\(s.label) is done. Nice work."
                endContent.sound = .default

                // The occurrence whose window contains `now` is INVISIBLE to
                // `upcomingOccurrences` (strictly-future starts only), so a
                // mid-window resync would sweep its end notification above and
                // never re-add it — and scheduled sessions have no other
                // completion notif (`ActiveSessionStore` deliberately skips
                // `scheduleExecutionBlockDone` for them because this
                // per-occurrence one covers them). Re-add the LIVE
                // occurrence's "Session Complete" explicitly.
                let liveWindow = s.activeWindow(now: now)
                if let live = liveWindow {
                    let ymd = ScheduledCompletionRecord.localYMD(live.end)
                    let endComps = cal.dateComponents(
                        [.year, .month, .day, .hour, .minute], from: live.end
                    )
                    center.add(UNNotificationRequest(
                        identifier: "\(ID.scheduledSessionEndPrefix).\(s.id).\(ymd)",
                        content: endContent,
                        trigger: UNCalendarNotificationTrigger(dateMatching: endComps, repeats: false)
                    )) { _ in }
                }

                // A one-off's single real occurrence IS the live one —
                // `upcomingOccurrences` would roll to a tomorrow that is
                // never registered (the session auto-disables once credited),
                // arming a phantom "locking in" ping.
                if s.isOneOff && liveWindow != nil { continue }

                for next in s.upcomingOccurrences(limit: horizon, after: now) {
                    // Date-scoped suffix keeps the two occurrences' ids distinct.
                    let ymd = ScheduledCompletionRecord.localYMD(next)

                    let startComps = cal.dateComponents(
                        [.year, .month, .day, .hour, .minute], from: next
                    )
                    center.add(UNNotificationRequest(
                        identifier: "\(ID.scheduledSessionPrefix).\(s.id).\(ymd)",
                        content: content,
                        trigger: UNCalendarNotificationTrigger(dateMatching: startComps, repeats: false)
                    )) { _ in }

                    // End is the same calendar day at the end time (windows never
                    // cross midnight — enforced by validation).
                    if let endDate = cal.date(bySettingHour: s.endHour, minute: s.endMinute, second: 0, of: next) {
                        let endComps = cal.dateComponents([.year, .month, .day, .hour, .minute], from: endDate)
                        center.add(UNNotificationRequest(
                            identifier: "\(ID.scheduledSessionEndPrefix).\(s.id).\(ymd)",
                            content: endContent,
                            trigger: UNCalendarNotificationTrigger(dateMatching: endComps, repeats: false)
                        )) { _ in }
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

    // MARK: - Break over

    /// Fire-once "break over" nudge at break-end. iOS can't re-apply the Screen
    /// Time shield at a sub-15-min wall-clock instant in the background (DeviceActivity
    /// has a ~15-min minimum interval; notifications can't run code), so this pulls
    /// the user back to LockedIn — whose foreground sync re-applies the shield
    /// instantly. Best-effort nudge, not a guarantee.
    ///
    /// Cancelled on every in-app break/session exit (`ActiveSessionStore`
    /// `handleBreakEnded` / `complete`), and on logout/FULL_RESET via the blanket
    /// `cancelAllNotifications()` in `LogoutCleanupBus`.
    public func scheduleBreakEnded(endsAt: Date) {
        cancelBreakEnded()
        let interval = endsAt.timeIntervalSinceNow
        guard interval > 0 else { return }

        let content = UNMutableNotificationContent()
        content.title = "Break over"
        content.body = "Time to lock back in — open LockedIn to resume focus."
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let request = UNNotificationRequest(identifier: ID.breakEnded, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request) { _ in }
    }

    public func cancelBreakEnded() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [ID.breakEnded]
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

        let goalMetToday = Defaults.string("@lockedin/goal_met_daykey") == SessionDayEngine.todayKey()
        scheduleAllDailyNotifications(
            streak: streak,
            hasGuild: hasGuild,
            goalMinutes: goalMinutes > 0 ? goalMinutes : 60,
            reminderTime: reminder,
            goalMetToday: goalMetToday
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
        // NOTE: streak-risk pings are intentionally NOT cancelled here. A
        // partial session that doesn't meet the daily goal must keep the streak
        // reminders armed. They are re-evaluated — and cleared only when the
        // goal is actually met — by `scheduleAllDailyNotifications(goalMetToday:)`
        // on the next Home re-render / foreground.
        cancelExecutionBlockDone()
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [ID.closeToGoal, ID.missionReminder]
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
        reminderTime: HourMinute,
        goalMetToday: Bool = false
    ) {
        // Master off toggle — honored here so EVERY caller (the direct Home /
        // session-finish paths, not just `refreshScheduleWithStoredStreak`)
        // respects it. Clear ONLY the daily set this function owns; do NOT
        // cancelAll here — this runs on hot Home/session paths and a global
        // cancel would nuke unrelated pending/delivered notifications (guild
        // month-end, streak milestone, first-guild nudge). The dedicated
        // "disable = wipe everything" lives in `refreshScheduleWithStoredStreak`.
        if Defaults.bool("@lockedin/notif_user_disabled") {
            UNUserNotificationCenter.current().removePendingNotificationRequests(
                withIdentifiers: [ID.dailyReminder, ID.streakProtection, ID.streakProtectionNoon]
            )
            return
        }

        // Daily reminder.
        scheduleDailyReminder(at: reminderTime)

        // Streak-risk pings: a midday nudge and an evening last-call. Armed only
        // while a streak is live and the streak-alerts opt-in is on. Each ping is
        // a ONE-SHOT for the NEXT occurrence: if today's goal is already met we
        // arm tomorrow's, otherwise today's (rolling to tomorrow once the hour
        // passes). One-shot (not repeating) is deliberate — a repeating trigger
        // removed on goal-met would leave the *next* at-risk day silently
        // uncovered if the app isn't reopened. A partial session that doesn't
        // meet the goal keeps today's ping armed.
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(
            withIdentifiers: [ID.streakProtection, ID.streakProtectionNoon]
        )
        let streakAlertsOn = Defaults.standard.object(forKey: "@lockedin/notif_streak_alerts") as? Bool ?? true
        if streak > 0 && streakAlertsOn {
            scheduleStreakRiskPing(
                id: ID.streakProtectionNoon,
                hour: Self.streakRiskNoonHour,
                skipToday: goalMetToday,
                title: "Your streak is at risk",
                body: "Today's goal isn't done yet. Lock in to keep your \(streak)-day streak alive."
            )
            scheduleStreakRiskPing(
                id: ID.streakProtection,
                hour: Self.streakRiskEveningHour,
                skipToday: goalMetToday,
                title: "Protect your \(streak)-day streak",
                body: "Lock in before midnight to keep the chain alive."
            )
        }

        // Persist snapshots so `refreshScheduleWithStoredStreak` can re-arm on
        // foreground without the caller re-supplying live state.
        Defaults.setInt(streak, "@lockedin/streak_for_notifs")
        Defaults.setInt(goalMinutes, "@lockedin/daily_minutes")
        Defaults.setBool(hasGuild, "@lockedin/has_active_guild")
        Defaults.setString(goalMetToday ? SessionDayEngine.todayKey() : "", "@lockedin/goal_met_daykey")

        if !hasGuild {
            scheduleFirstGuildNudgeIfNeeded(hasActiveGuild: false)
        }
    }

    /// Schedule a ONE-SHOT streak-risk notification at the next `hour`:00 local.
    /// When `skipToday` is true (today's goal already met) or today's `hour` has
    /// already passed, it rolls to tomorrow — so the reminder is always armed for
    /// the next day the streak could break, even if the app is never reopened.
    private func scheduleStreakRiskPing(id: String, hour: Int, skipToday: Bool, title: String, body: String) {
        let cal = Calendar.current
        let now = Date()
        var comps = cal.dateComponents([.year, .month, .day], from: now)
        comps.hour = hour
        comps.minute = 0
        guard let todayFire = cal.date(from: comps) else { return }

        let fireDate: Date
        if !skipToday && todayFire > now {
            fireDate = todayFire
        } else if let tomorrow = cal.date(byAdding: .day, value: 1, to: todayFire) {
            fireDate = tomorrow
        } else {
            return
        }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let triggerComps = cal.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: triggerComps, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request) { _ in }
    }
}
