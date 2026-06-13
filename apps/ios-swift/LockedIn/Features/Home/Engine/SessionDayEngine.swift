import Foundation

/// SessionDayEngine — Pure date/day-key helpers used by HomeState.
///
/// No SwiftUI / @Observable dependencies. Independently testable.
/// All day comparisons use timezone-safe local day keys (`YYYY-MM-DD`).
///
/// Ported 1:1 from `apps/mobile/src/features/home/engine/SessionEngine.ts`.
/// Renamed from `SessionEngine` to `SessionDayEngine` to disambiguate from
/// `Features/Session/SessionEngine.swift` (W11's runtime timer).
public enum SessionDayEngine {
    /// Local-day-key formatter, cached. ISO `YYYY-MM-DD` in the user's local
    /// timezone — matches the RN `ClockService.getLocalDateKey()` output.
    private static let dayKeyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone.current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    // MARK: - Day Key Helpers

    /// Returns today's date as a local day key: `YYYY-MM-DD`.
    public static func todayKey() -> String {
        dayKeyFormatter.string(from: Date())
    }

    /// Returns yesterday's date as a local day key.
    public static func yesterdayKey() -> String {
        let cal = Calendar(identifier: .gregorian)
        let yesterday = cal.date(byAdding: .day, value: -1, to: Date()) ?? Date()
        return dayKeyFormatter.string(from: yesterday)
    }

    /// Format a `Date` into a local-day key string.
    public static func dayKey(from date: Date) -> String {
        dayKeyFormatter.string(from: date)
    }

    /// Build a day key from an epoch-ms timestamp.
    public static func dayKey(fromTimestamp ts: TimeInterval) -> String {
        dayKey(from: Date(timeIntervalSince1970: ts / 1000.0))
    }

    /// Number of whole days between two day keys (end - start).
    public static func delta(start: String, end: String) -> Int {
        guard let s = dayKeyFormatter.date(from: start),
              let e = dayKeyFormatter.date(from: end)
        else { return 0 }
        let secs = e.timeIntervalSince(s)
        return Int((secs / 86_400.0).rounded())
    }

    // MARK: - Streak Calculation

    /// Compute the new streak value after meeting the daily goal today.
    ///
    /// Rules:
    /// - If `lastSessionDayKey == today`: keep current streak (same-day completion).
    /// - If `lastSessionDayKey == yesterday`: streak + 1 (consecutive).
    /// - Otherwise (gap or first session): reset to 1.
    public static func computeNewStreak(
        lastSessionDayKey: String?,
        currentStreak: Int,
        todayKey today: String
    ) -> Int {
        if let last = lastSessionDayKey, last == today {
            return currentStreak
        }
        if let last = lastSessionDayKey, last == yesterdayKey() {
            return currentStreak + 1
        }
        return 1
    }

    // MARK: - Weekly Helpers

    /// Returns the seven local-day keys (Mon → Sun) of the current ISO week.
    /// Matches the RN `getCurrentWeekDayKeys()` from `SystemStatusBar.tsx:55-69`.
    public static func currentWeekDayKeys(now: Date = Date()) -> [String] {
        let cal = Calendar(identifier: .gregorian)
        // Swift's `weekday` is 1-based with Sunday = 1. RN's `Date.getDay()`
        // returns 0 for Sunday. Convert into the JS form and apply the same
        // `mondayOffset` formula.
        let swiftWeekday = cal.component(.weekday, from: now)
        let jsWeekday = swiftWeekday - 1 // 0 = Sun ... 6 = Sat
        let mondayOffset = jsWeekday == 0 ? -6 : (1 - jsWeekday)

        var keys: [String] = []
        for i in 0..<7 {
            if let d = cal.date(byAdding: .day, value: mondayOffset + i, to: now) {
                keys.append(dayKey(from: d))
            }
        }
        return keys
    }

    /// The local-day key for the Monday that starts the current week.
    public static func currentWeekMondayKey(now: Date = Date()) -> String {
        return currentWeekDayKeys(now: now).first ?? todayKey()
    }
}
