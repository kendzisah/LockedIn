import Foundation
import Observation
import UIKit
import UserNotifications

/// Observable state container for the Settings (Profile tab).
///
/// Owns:
/// - Notification toggles (master push, streak alerts, guild updates)
/// - System notification authorization status (mirrored from
///   `UNUserNotificationCenter`)
/// - Daily reminder time (HH:MM 24-hour, persisted)
/// - User preferences (daily commitment minutes, primary goal, weaknesses)
///   that mirror RN `OnboardingProvider` fields
/// - HUD identity (display name, avatar URL) loaded from `profiles`
///
/// Side-effects when notification toggles change:
/// - On master ON: requests `.alert + .sound + .badge` permission, then
///   schedules a daily reminder via `UNUserNotificationCenter`.
/// - On master OFF or sub-toggle OFF: cancels matching pending notifications.
///
/// Persisted keys (match RN exactly — see RN `NotificationService.ts` +
/// `SettingsScreen.tsx`):
/// - `@lockedin/notif_user_disabled`  — Bool, user-chosen master toggle off
/// - `@lockedin/notif_streak_alerts`  — Bool, opt-in for streak alerts
/// - `@lockedin/notif_guild_updates`  — Bool, opt-in for guild updates
/// - `@lockedin/reminder_time`        — "HH:mm" 24-h, daily reminder time
/// - `@lockedin/has_active_guild`     — Bool, populated by Guild service
///
/// Note: per backend audit, RN's `NotificationService` is **local-only**
/// (no server push tokens table). Swift parity = local notifications only.
@MainActor
@Observable
public final class SettingsState {
    // MARK: - Persisted key names (match RN exactly)

    public static let notifUserDisabledKey = "@lockedin/notif_user_disabled"
    public static let notifStreakAlertsKey = "@lockedin/notif_streak_alerts"
    public static let notifGuildUpdatesKey = "@lockedin/notif_guild_updates"
    public static let reminderTimeKey      = "@lockedin/reminder_time"
    public static let hasActiveGuildKey    = "@lockedin/has_active_guild"

    // Plan / preference keys (kept in sync with OnboardingState when wired).
    // These keys are owned by W2 (Onboarding) — the Settings feature reads
    // current values and re-writes them via the OnboardingState bridge below
    // so the two providers don't drift.
    public static let dailyMinutesKey      = "@lockedin/daily_minutes"
    public static let primaryGoalKey       = "@lockedin/primary_goal"
    public static let weaknessesKey        = "@lockedin/weaknesses"

    /// Local notification request identifiers (used for cancellation by id).
    public enum NotificationID {
        public static let dailyReminder       = "lockedin.daily_reminder"
        public static let streakProtection    = "lockedin.streak_protection"
        public static let guildUpdates        = "lockedin.guild_updates"
    }

    // MARK: - Observable state

    /// System notification permission status as reported by `UNUserNotificationCenter`.
    public private(set) var systemAuthStatus: UNAuthorizationStatus = .notDetermined

    /// User-chosen master toggle. `true` means the user has tapped "off" in
    /// settings (irrespective of OS permission).
    public private(set) var userDisabledPush: Bool = false

    public private(set) var streakAlertsOn: Bool = true
    public private(set) var guildNotifsOn: Bool   = true
    public private(set) var hasGuild: Bool        = false

    /// 24-hour reminder time. Defaults to 09:00.
    public private(set) var reminderHour: Int   = 9
    public private(set) var reminderMinute: Int = 0

    /// User identity (loaded from `profiles`). Optional — guests have neither.
    public private(set) var displayName: String?
    public private(set) var avatarURL:   URL?

    /// User plan / preferences (mirrored from RN OnboardingProvider).
    public private(set) var dailyMinutes: Int     = 60
    public private(set) var primaryGoal:  String  = "Increase discipline & self-control"
    public private(set) var weaknesses:   [String] = []

    /// Derived: true when push notifications are effectively on (OS + user toggle).
    public var pushMasterOn: Bool {
        systemAuthStatus == .authorized && !userDisabledPush
    }

    /// Derived: true when the OS itself denies notifications (user must open
    /// Settings.app to flip).
    public var osDenied: Bool {
        systemAuthStatus == .denied
    }

    // MARK: - Init

    public init() {
        // Hydrate from persisted defaults synchronously so the first render is
        // accurate. Permission status is fetched asynchronously in `refresh()`.
        userDisabledPush = Defaults.bool(Self.notifUserDisabledKey)

        // Streak/guild toggles default ON. We treat the *absence* of a stored
        // value as "true" to match RN behaviour (`!== 'false'`).
        streakAlertsOn = Defaults.standard.object(forKey: Self.notifStreakAlertsKey) as? Bool ?? true
        guildNotifsOn  = Defaults.standard.object(forKey: Self.notifGuildUpdatesKey) as? Bool ?? true

        hasGuild = Defaults.bool(Self.hasActiveGuildKey)

        if let hhmm = Defaults.string(Self.reminderTimeKey), let parsed = Self.parseHHmm(hhmm) {
            reminderHour = parsed.hour
            reminderMinute = parsed.minute
        }

        let storedMinutes = Defaults.int(Self.dailyMinutesKey)
        if storedMinutes > 0 { dailyMinutes = storedMinutes }

        if let g = Defaults.string(Self.primaryGoalKey), !g.isEmpty {
            primaryGoal = g
        }

        if let stored = Defaults.codable([String].self, Self.weaknessesKey) {
            weaknesses = stored
        }
    }

    // MARK: - Public API

    /// Refresh all OS-backed state. Call on screen appear and on app
    /// foreground so the toggle stays in sync with Settings.app changes.
    public func refresh() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        self.systemAuthStatus = settings.authorizationStatus
        self.userDisabledPush = Defaults.bool(Self.notifUserDisabledKey)
        self.streakAlertsOn   = Defaults.standard.object(forKey: Self.notifStreakAlertsKey) as? Bool ?? true
        self.guildNotifsOn    = Defaults.standard.object(forKey: Self.notifGuildUpdatesKey) as? Bool ?? true
        self.hasGuild         = Defaults.bool(Self.hasActiveGuildKey)
    }

    /// Reload the persisted user-identity fields from a fresh Supabase
    /// `profiles` lookup. Safe to call repeatedly.
    public func reloadProfile(displayName: String?, avatarURL: URL?) {
        self.displayName = displayName
        self.avatarURL = avatarURL
    }

    // MARK: - Notification toggles

    /// Toggle the master push switch. When turning on, request system
    /// permission first; if the user previously denied, the system returns
    /// `.denied` immediately and the caller should redirect them to
    /// Settings.app.
    @discardableResult
    public func setPushMasterEnabled(_ on: Bool) async -> Bool {
        if on {
            // Request permission. If it's already authorized, this is a no-op
            // and returns true. If denied, returns false and the caller can
            // open OS settings.
            let granted = await requestNotificationPermission()
            Defaults.setBool(false, Self.notifUserDisabledKey)
            await refresh()
            if granted {
                await scheduleDailyReminder()
            }
            return granted
        } else {
            Defaults.setBool(true, Self.notifUserDisabledKey)
            await refresh()
            await cancelAllScheduledLocalNotifications()
            return true
        }
    }

    public func setStreakAlertsEnabled(_ on: Bool) async {
        Defaults.setBool(on, Self.notifStreakAlertsKey)
        streakAlertsOn = on
        if !on {
            await cancelNotifications(withIdentifierPrefix: NotificationID.streakProtection)
        }
    }

    public func setGuildNotifsEnabled(_ on: Bool) async {
        Defaults.setBool(on, Self.notifGuildUpdatesKey)
        guildNotifsOn = on
        if !on {
            await cancelNotifications(withIdentifierPrefix: NotificationID.guildUpdates)
        }
    }

    /// Update the daily reminder time. Persists and re-schedules the daily
    /// reminder if push master is on.
    public func setReminderTime(hour: Int, minute: Int) async {
        self.reminderHour = max(0, min(23, hour))
        self.reminderMinute = max(0, min(59, minute))
        let hhmm = String(format: "%02d:%02d", reminderHour, reminderMinute)
        Defaults.setString(hhmm, Self.reminderTimeKey)
        if pushMasterOn {
            await scheduleDailyReminder()
        }
    }

    // MARK: - Plan / preference updates

    public func setDailyCommitment(_ minutes: Int) {
        dailyMinutes = minutes
        Defaults.setInt(minutes, Self.dailyMinutesKey)
        SettingsAnalytics.log(SettingsAnalytics.settingsChanged, properties: [
            "setting": SettingsAnalytics.settingDailyCommitment,
            "value": minutes
        ])
    }

    public func setPrimaryGoal(_ goal: String) {
        primaryGoal = goal
        Defaults.setString(goal, Self.primaryGoalKey)
        SettingsAnalytics.log(SettingsAnalytics.settingsChanged, properties: [
            "setting": SettingsAnalytics.settingPrimaryGoal,
            "value": goal
        ])
    }

    public func setWeaknesses(_ list: [String]) {
        weaknesses = list
        Defaults.setCodable(list, Self.weaknessesKey)
        SettingsAnalytics.log(SettingsAnalytics.settingsChanged, properties: [
            "setting": SettingsAnalytics.settingWeaknesses,
            "value": list.joined(separator: ",")
        ])
    }

    // MARK: - Helpers

    /// Format the current reminder time as `9:00 AM` (matches RN
    /// `formatReminderHHmmAs12h`).
    public var reminderLabel: String {
        let am = reminderHour < 12
        let h12: Int = {
            if reminderHour == 0 { return 12 }
            if reminderHour == 12 { return 12 }
            return reminderHour > 12 ? reminderHour - 12 : reminderHour
        }()
        let mm = String(format: "%02d", reminderMinute)
        return "\(h12):\(mm) \(am ? "AM" : "PM")"
    }

    /// Open the OS Settings app (used when permission is denied).
    public func openOSSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }

    // MARK: - Notification scheduling (UNUserNotificationCenter)

    private func requestNotificationPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            return granted
        } catch {
            return false
        }
    }

    private func scheduleDailyReminder() async {
        let center = UNUserNotificationCenter.current()
        // Cancel any prior daily-reminder so re-scheduling at a new time
        // doesn't leave a duplicate.
        center.removePendingNotificationRequests(withIdentifiers: [NotificationID.dailyReminder])

        let content = UNMutableNotificationContent()
        content.title = "Time to Lock In"
        content.body  = "Your daily focus session is waiting. Tap to start."
        content.sound = .default

        var components = DateComponents()
        components.hour = reminderHour
        components.minute = reminderMinute

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(
            identifier: NotificationID.dailyReminder,
            content: content,
            trigger: trigger
        )

        do {
            try await center.add(request)
        } catch {
            #if DEBUG
            print("[SettingsState] scheduleDailyReminder failed:", error)
            #endif
        }
    }

    /// Cancel every pending request whose identifier starts with the given
    /// prefix. Used by the streak / guild toggles to drop those category of
    /// notifications without nuking the daily reminder.
    private func cancelNotifications(withIdentifierPrefix prefix: String) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let ids = pending.map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: ids)
    }

    private func cancelAllScheduledLocalNotifications() async {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }

    // MARK: - HH:mm parsing

    private static func parseHHmm(_ value: String) -> (hour: Int, minute: Int)? {
        let parts = value.split(separator: ":")
        guard parts.count == 2,
              let h = Int(parts[0]),
              let m = Int(parts[1]),
              (0...23).contains(h),
              (0...59).contains(m)
        else { return nil }
        return (h, m)
    }
}
