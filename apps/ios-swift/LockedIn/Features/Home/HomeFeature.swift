import Foundation

/// Public route names + types exposed by the Home feature.
///
/// Mirrors the React Navigation `TabParamList` from
/// `apps/mobile/src/types/navigation.ts:38`. The coordinator (Phase 2) wires
/// these strings into the SwiftUI navigation stack so deep-linking +
/// analytics route names match the RN app byte-for-byte.
public enum HomeRoute {
    /// Tab route name. **Must remain `"HomeTab"`** to match the RN
    /// `TabParamList` and PostHog screen-tracking strings.
    public static let tabName = "HomeTab"

    /// Cross-tab destinations the Home tab can navigate to. Strings are
    /// surfaced to the coordinator (not raw types) so the routing layer can
    /// be swapped without touching this feature.
    public enum Destination: String {
        case profileTab     = "ProfileTab"
        case missionsTab    = "MissionsTab"
        case lockInTab      = "LockInTab"
        case signUp         = "SignUp"
        case weeklyReport   = "WeeklyReport"
        case executionBlock = "ExecutionBlock"
    }

    /// PostHog events the Home tab is the source-of-truth for.
    public enum AnalyticsEvent {
        /// Fired in `HomeTab` after a successful streak recovery from the
        /// `StreakRecoveryService`. Property: `streak_days`.
        public static let streakRecovered = "Streak Recovered"
    }
}
