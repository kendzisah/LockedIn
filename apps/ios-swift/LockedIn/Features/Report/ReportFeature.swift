import Foundation

/// Public route names + analytics constants exposed by the Report feature.
///
/// Mirrors the React Navigation `MainStackParamList.WeeklyReport` from
/// `apps/mobile/src/types/navigation.ts:62`. The coordinator (Phase 2) wires
/// the `WeeklyReport` route string into the SwiftUI navigation stack so
/// deep-linking + analytics screen-tracking strings match the RN app
/// byte-for-byte.
public enum ReportRoute {
    /// Modal route name — **must remain `"WeeklyReport"`** to match the RN
    /// `MainStackParamList` entry and PostHog screen-tracking strings.
    /// Presentation: `animation: 'fade'` modal (see `MainNavigator.tsx:88-92`).
    public static let weeklyReport = "WeeklyReport"
}

/// PostHog events fired by the Report feature. Event names match
/// `WeeklyReportScreen.tsx:77` exactly.
public enum ReportAnalyticsEvent {
    /// Fired once on screen-appear. Properties:
    ///   - `grade`: `WeeklyReport.grade` (e.g. "A+")
    ///   - `streak_days`: Int
    ///   - `score`: Int — `totalFocusMinutes` (matches RN payload, NOT percentile)
    public static let weeklyReportViewed = "Weekly Report Viewed"
}

// MARK: - Analytics shim

/// Feature-local analytics shim for the Report flow. Forwards to the
/// canonical `AnalyticsService` (PostHog + AppsFlyer).
enum ReportAnalytics {
    static func log(_ event: String, properties: [String: Any] = [:]) {
        Task { @MainActor in
            AnalyticsService.shared.track(event, properties: properties)
        }
    }
}
