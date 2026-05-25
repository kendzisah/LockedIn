import Foundation

/// Feature-local analytics shim for the Settings flow.
///
/// Mirrors the PostHog events fired by the RN settings screens. When the
/// coordinator promotes a shared `AnalyticsService` (PostHog + AppsFlyer
/// wrapper), replace these calls with the canonical service.
///
/// Event names and properties must match RN exactly — see
/// `apps/mobile/src/features/settings/sheets/*.tsx` and the analytics
/// catalog in `MIGRATION_FRONTEND_INVENTORY.md` §9.
enum SettingsAnalytics {
    // Forwards to the canonical `AnalyticsService` (PostHog + AppsFlyer).

    static func log(_ event: String, properties: [String: Any] = [:]) {
        Task { @MainActor in
            AnalyticsService.shared.track(event, properties: properties)
        }
    }

    // MARK: - Event constants (PostHog)

    /// Fired by every settings picker sheet. `{ setting, value }`.
    static let settingsChanged = "Settings Changed"

    /// Fired by `DeleteAccountSheet`.
    static let accountDeleted = "Account Deleted"

    // MARK: - Setting keys (the `setting` property of `Settings Changed`)

    static let settingDailyCommitment = "daily_commitment"
    static let settingPrimaryGoal     = "primary_goal"
    static let settingWeaknesses      = "weaknesses"
}
