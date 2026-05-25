import Foundation

/// Swift port of `apps/mobile/src/features/gym/GymCheckInService.ts`.
///
/// Local-only (no Supabase). Persists check-in state at `@lockedin/gym_checkin`
/// in standard `UserDefaults`.
///
/// API mirrors the RN default-exported singleton 1:1:
/// - `checkIn(date:)`           (toggles)
/// - `isCheckedInToday()` -> Bool
/// - `getWeeklyCount()` -> Int
/// - `getMonthlyCount()` -> Int
/// - `getStreak()` -> Int       (consecutive days)
/// - `getWeekCheckIns()` -> [Bool] (7 — Mon..Sun)
/// - `getStatePublic()` -> State
/// - `clear()`
public struct GymCheckInState: Codable, Sendable, Equatable {
    public var checkins: [String: Bool]
    public var weeklyCount: Int
    public var monthlyCount: Int
    public var currentWeekStart: String   // YYYY-MM-DD
    public var currentMonthStart: String  // YYYY-MM-DD

    public init(
        checkins: [String: Bool] = [:],
        weeklyCount: Int = 0,
        monthlyCount: Int = 0,
        currentWeekStart: String,
        currentMonthStart: String
    ) {
        self.checkins = checkins
        self.weeklyCount = weeklyCount
        self.monthlyCount = monthlyCount
        self.currentWeekStart = currentWeekStart
        self.currentMonthStart = currentMonthStart
    }
}

public final class GymCheckInService {
    /// Persistence key — preserve verbatim from RN.
    public static let storageKey = "@lockedin/gym_checkin"

    /// Default-exported instance, mirroring the RN `export default new
    /// GymCheckInService()` pattern.
    public static let shared = GymCheckInService()

    private init() {}

    // MARK: - YYYY-MM-DD formatter (matches RN `formatDate`)

    private static func formatDate(_ date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let comps = cal.dateComponents([.year, .month, .day], from: date)
        let y = comps.year ?? 1970
        let m = comps.month ?? 1
        let d = comps.day ?? 1
        return String(format: "%04d-%02d-%02d", y, m, d)
    }

    private static func todayDateString() -> String {
        formatDate(Date())
    }

    /// Week starts on Monday (matches RN `getWeekStartDate`).
    private static func weekStartDate() -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let today = Date()
        // JS: dayOfWeek = today.getDay() (0 = Sunday, 1 = Monday)
        // daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        let weekday = cal.component(.weekday, from: today)  // 1 = Sun ... 7 = Sat
        let jsDay = (weekday == 1) ? 0 : weekday - 1        // convert to JS
        let daysToMonday = jsDay == 0 ? 6 : jsDay - 1
        let weekStart = cal.date(byAdding: .day, value: -daysToMonday, to: today) ?? today
        let zeroed = cal.startOfDay(for: weekStart)
        return formatDate(zeroed)
    }

    private static func monthStartDate() -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let today = Date()
        let comps = cal.dateComponents([.year, .month], from: today)
        let monthStart = cal.date(from: comps) ?? today
        return formatDate(monthStart)
    }

    /// Parse a YYYY-MM-DD string into a Date at midnight local time.
    private static func parseDate(_ string: String) -> Date? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let parts = string.split(separator: "-")
        guard parts.count == 3,
              let y = Int(parts[0]),
              let m = Int(parts[1]),
              let d = Int(parts[2]) else { return nil }
        var comps = DateComponents()
        comps.year = y; comps.month = m; comps.day = d
        return cal.date(from: comps)
    }

    // MARK: - State I/O

    /// Read / migrate state. Mirrors `getState()` from RN:
    /// - Initializes if nothing stored.
    /// - Backfills `currentMonthStart` for legacy data.
    /// - On week / month rollover, recounts from the `checkins` map.
    private func getState() -> GymCheckInState {
        guard var state: GymCheckInState = Defaults.codable(GymCheckInState.self, Self.storageKey) else {
            return Self.initializeState()
        }

        // Backfill — legacy installs may not have currentMonthStart.
        // (Swift Codable will already throw on missing key. We use a fallback
        // decoder for parity: try strict, fall back to a permissive struct.)
        if state.currentMonthStart.isEmpty {
            state.currentMonthStart = Self.monthStartDate()
        }

        let weekStart = Self.weekStartDate()
        if state.currentWeekStart != weekStart {
            state.currentWeekStart = weekStart
            state.weeklyCount = Self.countCheckinsInCurrentWeek(state.checkins, weekStart: weekStart)
        }

        let monthStart = Self.monthStartDate()
        if state.currentMonthStart != monthStart {
            state.currentMonthStart = monthStart
            state.monthlyCount = Self.countCheckinsInCurrentMonth(state.checkins, monthStart: monthStart)
        }

        return state
    }

    private static func initializeState() -> GymCheckInState {
        GymCheckInState(
            checkins: [:],
            weeklyCount: 0,
            monthlyCount: 0,
            currentWeekStart: weekStartDate(),
            currentMonthStart: monthStartDate()
        )
    }

    private func setState(_ state: GymCheckInState) {
        Defaults.setCodable(state, Self.storageKey)
    }

    // MARK: - Public API

    /// Check in for a specific date (default today). Toggles — a second call
    /// for the same date undoes the check-in.
    @discardableResult
    public func checkIn(date: String? = nil) -> GymCheckInState {
        let dateStr = date ?? Self.todayDateString()
        var state = getState()

        if state.checkins[dateStr] != true {
            state.checkins[dateStr] = true
            state.weeklyCount += 1
            state.monthlyCount += 1
        } else {
            state.checkins[dateStr] = false
            state.weeklyCount = max(0, state.weeklyCount - 1)
            state.monthlyCount = max(0, state.monthlyCount - 1)
        }

        setState(state)
        return state
    }

    public func isCheckedInToday() -> Bool {
        let state = getState()
        return state.checkins[Self.todayDateString()] == true
    }

    public func getWeeklyCount() -> Int {
        getState().weeklyCount
    }

    public func getMonthlyCount() -> Int {
        getState().monthlyCount
    }

    /// Consecutive days with check-ins, scanning back up to 365 days from today.
    public func getStreak() -> Int {
        let state = getState()
        var streak = 0
        let today = Date()
        let cal = Calendar(identifier: .gregorian)

        for i in 0..<365 {
            guard let d = cal.date(byAdding: .day, value: -i, to: today) else { break }
            let key = Self.formatDate(d)
            if state.checkins[key] == true {
                streak += 1
            } else if i > 0 {
                // Allow today to be unchecked without breaking the streak,
                // matching RN behavior.
                break
            }
        }
        return streak
    }

    /// Check-in status for the current week (Monday..Sunday) as an array of 7
    /// booleans.
    public func getWeekCheckIns() -> [Bool] {
        let state = getState()
        guard let weekStart = Self.parseDate(state.currentWeekStart) else {
            return Array(repeating: false, count: 7)
        }
        let cal = Calendar(identifier: .gregorian)
        return (0..<7).map { i in
            guard let d = cal.date(byAdding: .day, value: i, to: weekStart) else { return false }
            return state.checkins[Self.formatDate(d)] == true
        }
    }

    /// Public read-only access to the persisted state.
    public func getStatePublic() -> GymCheckInState {
        getState()
    }

    /// Wipe all check-in data.
    public func clear() {
        Defaults.remove(Self.storageKey)
    }

    // MARK: - Aggregations

    private static func countCheckinsInCurrentWeek(_ checkins: [String: Bool], weekStart: String) -> Int {
        guard let start = parseDate(weekStart) else { return 0 }
        let cal = Calendar(identifier: .gregorian)
        guard let end = cal.date(byAdding: .day, value: 7, to: start) else { return 0 }
        return checkins.reduce(0) { acc, entry in
            let (dateStr, checked) = entry
            guard checked, let d = parseDate(dateStr) else { return acc }
            return (d >= start && d < end) ? acc + 1 : acc
        }
    }

    private static func countCheckinsInCurrentMonth(_ checkins: [String: Bool], monthStart: String) -> Int {
        guard let start = parseDate(monthStart) else { return 0 }
        let cal = Calendar(identifier: .gregorian)
        guard let end = cal.date(byAdding: .month, value: 1, to: start) else { return 0 }
        return checkins.reduce(0) { acc, entry in
            let (dateStr, checked) = entry
            guard checked, let d = parseDate(dateStr) else { return acc }
            return (d >= start && d < end) ? acc + 1 : acc
        }
    }
}
