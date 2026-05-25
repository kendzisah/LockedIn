import Foundation

/// Persistence keys owned (read or written) by the Report feature. Every key
/// is preserved by exact name from the RN AsyncStorage inventory — see
/// `apps/ios-swift/MIGRATION_FRONTEND_INVENTORY.md` §4 (`@lockedin/weekly_reports`,
/// `@lockedin/report_shown_week`).
public enum ReportStorageKeys {
    /// Rolling window of the last 12 weekly reports, encoded as a JSON array
    /// of `WeeklyReport`. (`WeeklyReportService.ts:15`.)
    public static let weeklyReports = "@lockedin/weekly_reports"

    /// Stringified ISO week number (1…53) of the last week we presented the
    /// report — used by `shouldShowReport()` so we don't show twice in a
    /// single Sunday window. (`WeeklyReportService.ts:182`.)
    public static let reportShownWeek = "@lockedin/report_shown_week"
}

/// WeeklyReportService — Local-only persistence + "should we present today?"
/// gate for the weekly report.
///
/// Ported 1:1 from `apps/mobile/src/features/report/WeeklyReportService.ts`.
/// The RN file exports a `default new WeeklyReportService()` singleton — the
/// Swift port mirrors that with `WeeklyReportService.shared`.
///
/// **No Supabase calls** — Agent A's backend audit confirms the Report
/// feature is local-only (`MIGRATION_BACKEND_INVENTORY.md:387-388`).
public final class WeeklyReportService {
    public static let shared = WeeklyReportService()

    /// Max number of reports to retain in the rolling window. Matches the
    /// hard-coded `slice(-12)` in `WeeklyReportService.ts:131`.
    public static let maxReportsRetained = 12

    private init() {}

    // MARK: - Generation (re-export of ReportEngine for callsite parity)

    /// Generate a weekly report from current session/missions state and
    /// the user's daily commitment, then resolve the "previous grade"
    /// from the persisted history.
    ///
    /// Asynchronous to mirror the RN signature (RN's read of
    /// `AsyncStorage.getItem` is awaited). On the Swift side
    /// `UserDefaults` is synchronous, so `await` is effectively a no-op.
    public func generateWeeklyReport(
        sessionsCompletedThisWeek: Int,
        totalFocusMinutes: Int,
        completedMissions: Int,
        totalMissions: Int,
        streakDays: Int,
        dailyCommitment: Int,
        now: Date = Date()
    ) async -> WeeklyReport {
        let previousGrade = getLastReport()?.grade
        return ReportEngine.buildReport(
            sessionsCompletedThisWeek: sessionsCompletedThisWeek,
            totalFocusMinutes: totalFocusMinutes,
            completedMissions: completedMissions,
            totalMissions: totalMissions,
            streakDays: streakDays,
            dailyCommitment: dailyCommitment,
            previousGrade: previousGrade,
            now: now
        )
    }

    // MARK: - Persistence

    /// Persist a report. Deduplicates by `weekStartDate` (a re-generate for
    /// the same week replaces the prior entry) and trims to the most recent
    /// `maxReportsRetained` reports.
    public func saveReport(_ report: WeeklyReport) {
        var reports = getAllReports()
        reports.removeAll { $0.weekStartDate == report.weekStartDate }
        reports.append(report)
        if reports.count > Self.maxReportsRetained {
            reports = Array(reports.suffix(Self.maxReportsRetained))
        }
        Defaults.setCodable(reports, ReportStorageKeys.weeklyReports)
    }

    /// Most recently appended report, if any. Note this is the last element
    /// of the persisted array (FIFO append order), **not** the lexicographically
    /// largest `weekStartDate` — matches `WeeklyReportService.ts:147`.
    public func getLastReport() -> WeeklyReport? {
        let reports = getAllReports()
        return reports.last
    }

    /// Full persisted history (oldest first). Returns `[]` when storage is
    /// empty or corrupt.
    public func getAllReports() -> [WeeklyReport] {
        Defaults.codable([WeeklyReport].self, ReportStorageKeys.weeklyReports) ?? []
    }

    // MARK: - "Should show this week?" gate

    /// Returns `true` when:
    ///   1. Today is **Sunday** (local time), **and**
    ///   2. We have not already marked the report as shown for the current
    ///      ISO week (via `markReportAsShown()`).
    ///
    /// Coordinator usage: HomeTab's `onAppear` calls this — when `true`,
    /// navigate to the `WeeklyReport` route. (`HomeTab.tsx:210-212`.)
    public func shouldShowReport(now: Date = Date()) -> Bool {
        // Local-day-of-week check: 1 = Sunday in Swift's Calendar.
        let cal = Calendar(identifier: .gregorian)
        let weekday = cal.component(.weekday, from: now)
        guard weekday == 1 else { return false } // Not Sunday.

        let currentWeek = ReportEngine.weekNumber(for: now)
        if let shown = Defaults.string(ReportStorageKeys.reportShownWeek),
           shown == String(currentWeek) {
            return false
        }
        return true
    }

    /// Mark the current ISO week as "report already shown" — flips the gate
    /// for `shouldShowReport()` for the rest of the week.
    public func markReportAsShown(now: Date = Date()) {
        let currentWeek = ReportEngine.weekNumber(for: now)
        Defaults.setString(String(currentWeek), ReportStorageKeys.reportShownWeek)
    }
}
