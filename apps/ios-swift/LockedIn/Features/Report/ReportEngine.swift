import Foundation

// MARK: - WeeklyReport model

/// A computed weekly discipline report. JSON-encoded and stored under
/// `@lockedin/weekly_reports` (rolling window of the last 12).
///
/// Ported 1:1 from `apps/mobile/src/features/report/WeeklyReportService.ts`:
///   - `weekStartDate`: ISO-8601 string for the Sunday that starts the week
///     (RN normalizes by `now.getDay()`; we match exactly — see notes below).
///   - `grade`: A+ / A / B+ / B / C / D / F (no minus tiers, matches RN enum).
///   - `percentile`: weighted score clamped to `0…100`.
public struct WeeklyReport: Codable, Equatable, Sendable, Identifiable {
    public var weekStartDate: String
    public var daysLockedIn: Int
    public var totalFocusMinutes: Int
    public var missionsCompleted: Int
    public var totalMissions: Int
    public var streakDays: Int
    public var grade: Grade
    public var previousGrade: Grade?
    public var percentile: Int

    /// Stable identity for `Identifiable` — keyed by `weekStartDate` so reports
    /// for the same week round-trip through diff-able SwiftUI lists.
    public var id: String { weekStartDate }

    public enum Grade: String, Codable, Equatable, Sendable, CaseIterable {
        case aPlus = "A+"
        case a = "A"
        case bPlus = "B+"
        case b = "B"
        case c = "C"
        case d = "D"
        case f = "F"

        /// Numeric ordering for grade comparisons. Mirrors `GRADE_ORDER` from
        /// `WeeklyReportScreen.tsx:120`. Lower index = better grade.
        ///
        /// **Parity note**: RN's table also lists `A-`, `B-`, `C-`, etc. The
        /// service never emits those tiers (see `scoreToGrade`), but the
        /// screen's compare table tolerates them via `?? 12`. Swift only needs
        /// the emitted set; any stored legacy value decodes via `init(from:)`
        /// fallback below.
        public var order: Int {
            switch self {
            case .aPlus: return 0
            case .a:     return 1
            case .bPlus: return 3
            case .b:     return 4
            case .c:     return 7
            case .d:     return 10
            case .f:     return 12
            }
        }

        /// Lenient decoder — unknown grade strings (e.g. legacy `A-`) decode
        /// to `.f` so historic reports never throw at hydrate time.
        public init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = Grade(rawValue: raw) ?? .f
        }
    }

    public init(
        weekStartDate: String,
        daysLockedIn: Int,
        totalFocusMinutes: Int,
        missionsCompleted: Int,
        totalMissions: Int,
        streakDays: Int,
        grade: Grade,
        previousGrade: Grade? = nil,
        percentile: Int
    ) {
        self.weekStartDate = weekStartDate
        self.daysLockedIn = daysLockedIn
        self.totalFocusMinutes = totalFocusMinutes
        self.missionsCompleted = missionsCompleted
        self.totalMissions = totalMissions
        self.streakDays = streakDays
        self.grade = grade
        self.previousGrade = previousGrade
        self.percentile = percentile
    }

    /// Default-zero report. Mirrors `defaultReport` in
    /// `WeeklyReportScreen.tsx:31` — used when the screen mounts without an
    /// explicit report (smoke test / no data yet).
    public static func defaultReport() -> WeeklyReport {
        WeeklyReport(
            weekStartDate: ISO8601DateFormatter().string(from: Date()),
            daysLockedIn: 0,
            totalFocusMinutes: 0,
            missionsCompleted: 0,
            totalMissions: 21,
            streakDays: 0,
            grade: .f,
            previousGrade: nil,
            percentile: 0
        )
    }
}

// MARK: - Engine (pure logic)

/// ReportEngine — Pure scoring + grading helpers.
///
/// No SwiftUI / @Observable dependencies. Independently testable.
///
/// Ported 1:1 from the private helpers of
/// `apps/mobile/src/features/report/WeeklyReportService.ts`:
///   - `calculateWeightedScore` — 40% days, 30% focus vs commitment, 30% missions.
///   - `scoreToGrade` — A+ ≥95, A ≥85, B+ ≥75, B ≥60, C ≥45, D ≥30, else F.
///   - `getWeekNumber` — ISO-week number (1…53) for the "shown this week" gate.
public enum ReportEngine {
    /// Calculate the weighted discipline score (0…~100).
    ///
    /// Weights mirror `WeeklyReportService.ts:24-42`:
    /// - **Days locked in** (40%): `(days/7) * 100 * 0.4` — uncapped before scale.
    /// - **Focus minutes vs commitment** (30%): clamped at 100 before scale.
    /// - **Missions** (30%): `(completed/total) * 100 * 0.3`, 0 when `total == 0`.
    public static func calculateWeightedScore(
        daysLockedIn: Int,
        totalFocusMinutes: Int,
        dailyCommitment: Int,
        missionsCompleted: Int,
        totalMissions: Int
    ) -> Double {
        // Days locked in score: 40% (max 7 days)
        let daysScore = (Double(daysLockedIn) / 7.0) * 100.0 * 0.4

        // Focus minutes score: 30% (ratio vs daily commitment * 7)
        // Guard against div-by-zero when `dailyCommitment == 0` (RN doesn't,
        // but we match the spec by clamping the ratio to 100 before scaling).
        let commitmentMinutes = max(dailyCommitment * 7, 1)
        let focusRatio = Double(totalFocusMinutes) / Double(commitmentMinutes)
        let focusScore = min(focusRatio * 100.0, 100.0) * 0.3

        // Missions score: 30% (ratio of completed vs total)
        let missionsScore: Double
        if totalMissions > 0 {
            missionsScore = (Double(missionsCompleted) / Double(totalMissions)) * 100.0 * 0.3
        } else {
            missionsScore = 0
        }

        return daysScore + focusScore + missionsScore
    }

    /// Convert a weighted score (0…100+) into a letter grade.
    public static func scoreToGrade(_ score: Double) -> WeeklyReport.Grade {
        if score >= 95 { return .aPlus }
        if score >= 85 { return .a }
        if score >= 75 { return .bPlus }
        if score >= 60 { return .b }
        if score >= 45 { return .c }
        if score >= 30 { return .d }
        return .f
    }

    // MARK: - Week start (Sunday-anchored)

    /// Return the `weekStartDate` ISO-8601 string for `now`.
    ///
    /// Matches the RN logic in `WeeklyReportService.ts:73-77`:
    ///   ```
    ///   const dayOfWeek = now.getDay();          // 0 = Sunday … 6 = Saturday
    ///   weekStart = now - dayOfWeek days
    ///   weekStart.setHours(0,0,0,0)
    ///   ```
    /// So the anchor is **Sunday** at local-midnight. The output ISO string
    /// includes timezone offset — Swift's `ISO8601DateFormatter` defaults to
    /// UTC ("Z"), so we explicitly enable internet-date-time + fractional
    /// seconds to match `Date.prototype.toISOString()` byte-for-byte.
    public static func weekStartISOString(now: Date = Date()) -> String {
        let cal = Calendar(identifier: .gregorian)
        // Swift `weekday`: Sunday = 1, … Saturday = 7.
        // JS `getDay()`:   Sunday = 0, … Saturday = 6.
        let swiftWeekday = cal.component(.weekday, from: now)
        let jsDayOfWeek = swiftWeekday - 1

        // Subtract days to reach the Sunday-anchored week start (in local TZ).
        guard let sunday = cal.date(byAdding: .day, value: -jsDayOfWeek, to: now) else {
            return iso8601String(from: now)
        }
        // Floor to local midnight, then emit a UTC ISO string (matches
        // `Date.prototype.toISOString()` semantics — local midnight gets
        // converted into the equivalent UTC moment).
        var startOfDay = cal.dateComponents([.year, .month, .day], from: sunday)
        startOfDay.hour = 0
        startOfDay.minute = 0
        startOfDay.second = 0
        startOfDay.nanosecond = 0
        let date = cal.date(from: startOfDay) ?? sunday
        return iso8601String(from: date)
    }

    private static let iso8601: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(secondsFromGMT: 0)
        return f
    }()

    private static func iso8601String(from date: Date) -> String {
        iso8601.string(from: date)
    }

    // MARK: - Week number (for "shown this week" gate)

    /// Compute an ISO-week number (1…53) for a given date.
    ///
    /// Mirrors `WeeklyReportService.ts:212-218` (Thursday-anchored Jan-1
    /// ISO-week formula). Used as the deduplication key for "already shown
    /// this week" via the `@lockedin/report_shown_week` UserDefault.
    public static func weekNumber(for date: Date = Date()) -> Int {
        // Strip time + force UTC, matching `Date.UTC(...)` in RN.
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(secondsFromGMT: 0)!
        let comps = cal.dateComponents([.year, .month, .day], from: date)
        guard let utcDate = cal.date(from: comps) else { return 1 }

        // `dayNum`: 1 = Mon … 7 = Sun (ISO weekday).
        let swiftWeekday = cal.component(.weekday, from: utcDate)
        let dayNum: Int = (swiftWeekday == 1) ? 7 : (swiftWeekday - 1)

        // Shift to the Thursday of the current ISO week.
        guard let shifted = cal.date(byAdding: .day, value: 4 - dayNum, to: utcDate) else { return 1 }
        let year = cal.component(.year, from: shifted)
        var yearStartComps = DateComponents()
        yearStartComps.year = year
        yearStartComps.month = 1
        yearStartComps.day = 1
        guard let yearStart = cal.date(from: yearStartComps) else { return 1 }

        let secondsPerDay: TimeInterval = 86_400
        let dayDelta = (shifted.timeIntervalSince(yearStart) / secondsPerDay) + 1
        return Int((dayDelta / 7.0).rounded(.up))
    }

    // MARK: - Report builder

    /// Build a `WeeklyReport` from raw inputs. Matches
    /// `WeeklyReportService.generateWeeklyReport` exactly.
    ///
    /// - Parameters:
    ///   - sessionsCompletedThisWeek: capped to 7 (one per day).
    ///   - totalFocusMinutes: lifetime/weekly focus minutes.
    ///   - completedMissions / totalMissions: from MissionsState. `totalMissions`
    ///     defaults to 21 (3 per day × 7 days) when 0 — RN line 83.
    ///   - streakDays: consecutive streak.
    ///   - dailyCommitment: user's daily focus commitment in minutes.
    ///   - previousGrade: the last persisted grade (for the "you went from X
    ///     to Y" message). Pass `nil` when there's no history.
    public static func buildReport(
        sessionsCompletedThisWeek: Int,
        totalFocusMinutes: Int,
        completedMissions: Int,
        totalMissions: Int,
        streakDays: Int,
        dailyCommitment: Int,
        previousGrade: WeeklyReport.Grade?,
        now: Date = Date()
    ) -> WeeklyReport {
        let daysLockedIn = min(sessionsCompletedThisWeek, 7)
        // Match RN: `totalMissions || 21` (truthy fallback when zero).
        let resolvedTotalMissions = totalMissions > 0 ? totalMissions : 21

        let score = calculateWeightedScore(
            daysLockedIn: daysLockedIn,
            totalFocusMinutes: totalFocusMinutes,
            dailyCommitment: dailyCommitment,
            missionsCompleted: completedMissions,
            totalMissions: resolvedTotalMissions
        )
        let grade = scoreToGrade(score)
        let percentile = min(Int(score.rounded()), 100)

        return WeeklyReport(
            weekStartDate: weekStartISOString(now: now),
            daysLockedIn: daysLockedIn,
            totalFocusMinutes: totalFocusMinutes,
            missionsCompleted: completedMissions,
            totalMissions: resolvedTotalMissions,
            streakDays: streakDays,
            grade: grade,
            previousGrade: previousGrade,
            percentile: percentile
        )
    }
}
