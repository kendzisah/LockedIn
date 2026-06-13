import Foundation

/// Public route names + analytics events exposed by the Missions feature.
///
/// Mirrors the React Navigation `TabParamList.MissionsTab` from
/// `apps/mobile/src/types/navigation.ts:38` and the PostHog event names
/// dispatched from `apps/mobile/src/features/missions/MissionsProvider.tsx`.
public enum MissionsRoute {
    /// Tab route name. **Must remain `"MissionsTab"`** to match the RN
    /// `TabParamList` and PostHog screen-tracking strings.
    public static let tabName = "MissionsTab"

    /// PostHog events the Missions feature is the source-of-truth for.
    /// Names are exact-string ports — do not rename or coalesce.
    public enum AnalyticsEvent {
        /// Fired when the user opens the mission detail modal.
        /// Properties: `mission_id`, `mission_title`.
        public static let missionViewed = "Mission Viewed"
        /// Fired when a mission is completed.
        /// Properties: `mission_id`, `mission_title`, `mission_type`,
        /// `mission_difficulty`, `xp`, `slot`, `completed_count`.
        public static let missionCompleted = "Mission Completed"
        /// Fired when all daily missions are completed (perfect day).
        /// Properties: `total_xp`.
        public static let allMissionsCompleted = "All Missions Completed"
        /// Fired by `DailyActivityCard` after a successful log.
        /// Properties: `goal`, `template`.
        public static let dailyActivityLogged = "Daily Activity Logged"
    }
}
